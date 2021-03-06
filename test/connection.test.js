import Connection, {TYPE_MESSAGE, TYPE_RESPONSE} from '../lib/connection';

describe('Connection', function () {
    const CALL_ID = 'fake-call-id';

    beforeEach(function () {
        this.localApi = sinon.stub({
            testLocalMethod: () => {
            }
        });

        this.registerOnMessageListener = (listener) => {
            this.callMessageListener = listener;
        };
        this.postMessage = sinon.stub();
    });

    it('should init onnection', function () {
        let conn = new Connection(this.postMessage, this.registerOnMessageListener);
        conn.should.not.be.undefined;
    });

    it('should call remote and wait for response', function (done) {
        let conn = new Connection(this.postMessage, this.registerOnMessageListener);
        conn.setInterface(['testMethod']);

        conn.remote.testMethod('test', 123)
            .then(res => {
                res.should.eql({foo: 'bar'});
                done();
            });


        //Emulate response
        this.callMessageListener({
            data: {
                callId: this.postMessage.getCall(0).args[0].callId,
                type: TYPE_RESPONSE,
                success: true,
                result: {foo: 'bar'}
            }
        });
    });

    it('should handle failure of remote method', function (done) {
        let conn = new Connection(this.postMessage, this.registerOnMessageListener);
        conn.setInterface(['testMethod']);

        conn.remote.testMethod('test', 123)
            .catch(err => {
                err.should.eql({message: 'bar'});
                done();
            });


        //Emulate response
        this.callMessageListener({
            data: {
                callId: this.postMessage.getCall(0).args[0].callId,
                type: TYPE_RESPONSE,
                success: false,
                result: {message: 'bar'}
            }
        });
    });

    it('should call local API on remote call', function (done) {
        //First notify connection that localApi was registered on other side
        const conn = new Connection(this.postMessage, this.registerOnMessageListener);
        sinon.stub(conn, 'registerCallback').callsFake((resolve) => resolve());

        conn.setLocalApi(this.localApi)
            .then(() => {

                this.callMessageListener({
                    data: {
                        callId: CALL_ID,
                        type: TYPE_MESSAGE,
                        methodName: 'testLocalMethod',
                        arguments: [{foo: 'bar'}, 123]
                    }
                });
            })
            .then(() => {
                conn.localApi.testLocalMethod.should.have.been.calledWith({foo: 'bar'}, 123);
                done();
            });


    });

    it('should response to remote call', function (done) {
        const conn = new Connection(this.postMessage, this.registerOnMessageListener);
        sinon.stub(conn, 'registerCallback').callsFake((resolve) => resolve());

        this.localApi.testLocalMethod.returns({fake: TYPE_RESPONSE});

        conn.setLocalApi(this.localApi)
            .then(() => {
                this.callMessageListener({
                    data: {
                        callId: CALL_ID,
                        type: TYPE_MESSAGE,
                        methodName: 'testLocalMethod',
                        arguments: []
                    }
                });
            })
            .then(() => {
                setTimeout(() => {
                    this.postMessage.should.have.been.calledWith({
                        callId: "fake-call-id",
                        result: {fake: TYPE_RESPONSE},
                        success: true,
                        type: "response"
                    }, '*');
                    done();
                }, 10);
            });
    });

    it('should resolve remote methods wait promise', function (done) {
        const resolved = sinon.spy();
        const conn = new Connection(this.postMessage, this.registerOnMessageListener);
        
        Promise.resolve(conn.remoteMethodsWaitPromise).then(resolved);

        new Promise(resolve => setTimeout(resolve))
            .then(() => resolved.should.not.have.been.called)
            .then(() => conn.setInterface(['testMethod']))
            .then(() => new Promise(resolve => setTimeout(resolve)))
            .then(() => resolved.should.have.been.called)
            .then(() => done());
    });
});