import { IActivityRequestHandler, FlowContext, AsyncResponse, RequestRouter, HandlerFactory, FlowInstance } from '../src/omahdog/FlowContext';
import { SNSEvent } from 'aws-lambda/trigger/sns';
import { ErrorResponse } from '../src/omahdog/FlowExchanges';
import { ExchangeRequestMessage, ExchangeResponseMessage } from '../src/omahdog-aws/Exchange';
import { LambdaActivityRequestHandler } from '../src/omahdog-aws/LambdaActivityRequestHandler';
import * as AWSMock from 'aws-sdk-mock';
import AWS, { AWSError, Request as AWSRequest } from 'aws-sdk';
import { IFunctionInstanceRepository, FunctionInstance } from '../src/omahdog-aws/IFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from '../src/omahdog-aws/SNSExchangeMessagePublisher';
import SNS, { PublishInput, PublishResponse } from 'aws-sdk/clients/sns';
import { expect } from 'chai';
import { Substitute, Arg } from '@fluffy-spoon/substitute';
import { IResumableRequestHandler } from '../src/omahdog/FlowRequestHandler';
import { SNSPublishMessageResource } from '../src/omahdog-aws/AwsResources';
import { ConstantValue } from '../src/omahdog-aws/SAMTemplate';

class TestRequest {
    input: number
}

class TestResponse {
    output: number
}

class TestActivityRequestHandler implements IActivityRequestHandler<TestRequest, TestResponse>, IResumableRequestHandler {

    request?: TestRequest;
    response?: () => TestResponse | AsyncResponse;
    
    async handle(flowContext: FlowContext, request: TestRequest): Promise<TestResponse | AsyncResponse> {                
        expect(request).to.deep.equal(this.request);
        if (this.response === undefined) throw new Error('this.response === undefined');
        return this.response();
    }    

    async resume(flowContext: FlowContext): Promise<any> {
        if (this.response === undefined) throw new Error('this.response === undefined');
        return this.response();
    }
}

describe('LambdaActivityRequestHandler tests', () => {

    beforeEach(() => {
        AWSMock.setSDKInstance(AWS);        
    });

    afterEach(() => {
        AWSMock.restore('SNS');
    });

    it('handles SNS request with synchronous handler response', async () => {

        // Arrange

        let actualPublishInput: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            actualPublishInput = params;
            callback(null, {
                MessageId: 'MessageId'
            });
        });
        
        const request: TestRequest = { input: 666 };
        const response: TestResponse = { output: 616 };

        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .addInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): TestResponse => response;
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher?
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {
            publisher.resources.exchangeTopic = 
                new SNSPublishMessageResource(undefined, new ConstantValue(exchangeTopicArn), sns);
        });

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const requestMessage: ExchangeRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                handlerTypeName: 'handlerTypeName',
                requestId: 'requestId'
            },
            request: request
        };
            
        // Act

        await lambdaHandlerSut.handle(TestActivityRequestHandler, getSNSEvent(requestMessage));
        
        // Assert
        
        expect(actualPublishInput).to.not.be.undefined;

        if (actualPublishInput !== undefined) {

            actualPublishInput = actualPublishInput as PublishInput;

            expect(actualPublishInput.TopicArn).to.equal(exchangeTopicArn);
            expect(actualPublishInput.MessageAttributes?.MessageType?.DataType).to.equal('String');
            expect(actualPublishInput.MessageAttributes?.MessageType?.StringValue).to.equal('handlerTypeName:Response');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as ExchangeResponseMessage;

            expect(responseMessage.callingContext).to.deep.equal(requestMessage.callingContext);
            expect(responseMessage.response).to.deep.equal(response);
        }
    });    

    it('handles SNS request with asynchronous handler response', async () => {

        // Arrange

        let actualPublishInput: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            actualPublishInput = params;
            callback(null, {
                MessageId: 'MessageId'
            });
        });
        
        const request: TestRequest = { input: 666 };
        const response = new AsyncResponse('flowCorrelationId', 'instanceId', [], 'requestId');

        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .addInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): AsyncResponse => response;
            });
        const sns = new AWS.SNS();
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {
            publisher.resources.exchangeTopic = 
                new SNSPublishMessageResource(undefined, new ConstantValue(exchangeTopicArn), sns);
        });

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const requestMessage: ExchangeRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                handlerTypeName: 'handlerTypeName',
                requestId: 'requestId'
            },
            request: request
        };

        let functionInstance: FunctionInstance | undefined;

        flowInstanceRepository.store(Arg.is((fi: FunctionInstance) => {
            functionInstance = fi;
            return true;
        }));
            
        // Act

        await lambdaHandlerSut.handle(TestActivityRequestHandler, getSNSEvent(requestMessage));
        
        // Assert
        
        expect(actualPublishInput).to.be.undefined;

        expect(functionInstance).to.not.be.undefined;

        if (functionInstance !== undefined) {
            expect(functionInstance.callingContext).to.deep.equal(requestMessage.callingContext);
            expect(functionInstance.flowInstance.correlationId).to.equal(requestMessage.callingContext.flowCorrelationId);
            expect(functionInstance.resumeCount).to.equal(0);
        }
    });    

    it('handles asynchronous response', async () => {

        // Arrange

        let actualPublishInput: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            actualPublishInput = params;
            callback(null, {
                MessageId: 'MessageId'
            });
        });
        
        const response: TestResponse = { output: 616 };

        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .addInitialiser(TestActivityRequestHandler, handler => {
                handler.response = (): TestResponse => response;
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {
            publisher.resources.exchangeTopic = 
                new SNSPublishMessageResource(undefined, new ConstantValue(exchangeTopicArn), sns);
        });
        
        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const responseMessage: ExchangeResponseMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                handlerTypeName: 'handlerTypeName',
                requestId: 'ExchangeRequestId'
            },
            response: {}
        };

        const functionInstance: FunctionInstance = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'callingFlowInstanceId',
                handlerTypeName: 'callingHandlerTypeName',
                requestId: 'callingRequestId'
            },
            requestId: 'ExchangeRequestId',
            flowInstance: new FlowInstance('flowCorrelationId', 'flowInstanceId', []),
            resumeCount: 0
        };

        flowInstanceRepository
            .retrieve(Arg.is(v => v === 'flowInstanceId'))
            .resolves(functionInstance);

        // Act

        await lambdaHandlerSut.handle(TestActivityRequestHandler, getSNSEvent(responseMessage));
        
        // Assert
        
        expect(actualPublishInput).to.not.be.undefined;

        if (actualPublishInput !== undefined) {

            actualPublishInput = actualPublishInput as PublishInput;

            expect(actualPublishInput.TopicArn).to.equal(exchangeTopicArn);
            expect(actualPublishInput.MessageAttributes?.MessageType?.DataType).to.equal('String');
            expect(actualPublishInput.MessageAttributes?.MessageType?.StringValue).to.equal('callingHandlerTypeName:Response');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as ExchangeResponseMessage;

            expect(responseMessage.callingContext).to.deep.equal(functionInstance.callingContext);
            expect(responseMessage.response).to.deep.equal(response);
        }

        flowInstanceRepository.received()
            .delete(Arg.is(v => v === 'flowInstanceId'));
    });

    it('returns error response on error to SNS request', async () => {

        // Arrange

        let actualPublishInput: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            actualPublishInput = params;
            callback(null, {
                MessageId: 'MessageId'
            });
        });
        
        const request: TestRequest = { input: 666 };

        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .addInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): TestResponse => {throw new Error('Something went bandy!');};
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {
            publisher.resources.exchangeTopic = 
                new SNSPublishMessageResource(undefined, new ConstantValue(exchangeTopicArn), sns);
        });

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const requestMessage: ExchangeRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                handlerTypeName: 'handlerTypeName',
                requestId: 'requestId'
            },
            request: request
        };
            
        // Act

        await lambdaHandlerSut.handle(TestActivityRequestHandler, getSNSEvent(requestMessage));
        
        // Assert
        
        expect(actualPublishInput).to.not.be.undefined;

        if (actualPublishInput !== undefined) {

            actualPublishInput = actualPublishInput as PublishInput;

            expect(actualPublishInput.TopicArn).to.equal(exchangeTopicArn);
            expect(actualPublishInput.MessageAttributes?.MessageType?.DataType).to.equal('String');
            expect(actualPublishInput.MessageAttributes?.MessageType?.StringValue).to.equal('handlerTypeName:Response');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as ExchangeResponseMessage;

            expect(responseMessage.callingContext).to.deep.equal(requestMessage.callingContext);
            expect('ErrorResponse' in responseMessage.response, 'ErrorResponse').to.be.true;
            expect((responseMessage.response as ErrorResponse).message).to.equal('Something went bandy!');
        }
    });    

    it('handles asynchronous error response', async () => {

        // Arrange

        let actualPublishInput: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            actualPublishInput = params;
            callback(null, {
                MessageId: 'MessageId'
            });
        });
        
        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .addInitialiser(TestActivityRequestHandler, handler => {
                handler.response = (): TestResponse => {throw new Error('Something went bandy!');};
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {
            publisher.resources.exchangeTopic = 
                new SNSPublishMessageResource(undefined, new ConstantValue(exchangeTopicArn), sns);
        });

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const responseMessage: ExchangeResponseMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                handlerTypeName: 'handlerTypeName',
                requestId: 'ExchangeRequestId'
            },
            response: {}
        };

        const functionInstance: FunctionInstance = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'callingFlowInstanceId',
                handlerTypeName: 'callingHandlerTypeName',
                requestId: 'callingRequestId'
            },
            requestId: 'ExchangeRequestId',
            flowInstance: new FlowInstance('flowCorrelationId', 'flowInstanceId', []),
            resumeCount: 0
        };

        flowInstanceRepository
            .retrieve(Arg.is(v => v === 'flowInstanceId'))
            .resolves(functionInstance);

        // Act

        await lambdaHandlerSut.handle(TestActivityRequestHandler, getSNSEvent(responseMessage));
        
        // Assert
        
        expect(actualPublishInput).to.not.be.undefined;

        if (actualPublishInput !== undefined) {

            actualPublishInput = actualPublishInput as PublishInput;

            expect(actualPublishInput.TopicArn).to.equal(exchangeTopicArn);
            expect(actualPublishInput.MessageAttributes?.MessageType?.DataType).to.equal('String');
            expect(actualPublishInput.MessageAttributes?.MessageType?.StringValue).to.equal('callingHandlerTypeName:Response');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as ExchangeResponseMessage;

            expect(responseMessage.callingContext).to.deep.equal(functionInstance.callingContext);
            expect('ErrorResponse' in responseMessage.response, 'ErrorResponse').to.be.true;
            expect((responseMessage.response as ErrorResponse).message).to.equal('Something went bandy!');
        }

        flowInstanceRepository.received()
            .delete(Arg.is(v => v === 'flowInstanceId'));
    });    

    it('handles direct request with synchronous handler response', async () => {

        // Arrange

        let actualPublishInput: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            actualPublishInput = params;
            callback(null, {
                MessageId: 'MessageId'
            });
        });
        
        const request: TestRequest = { input: 666 };
        const response: TestResponse = { output: 616 };

        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .addInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): TestResponse => response;
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {
            publisher.resources.exchangeTopic = 
                new SNSPublishMessageResource(undefined, new ConstantValue(exchangeTopicArn), sns);
        });

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const requestMessage: ExchangeRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                handlerTypeName: 'handlerTypeName',
                requestId: 'requestId'
            },
            request: request
        };
            
        // Act

        const responseMessage = await lambdaHandlerSut.handle(TestActivityRequestHandler, requestMessage);
        
        // Assert
        
        expect(actualPublishInput).to.be.undefined;

        if (responseMessage !== undefined) {

            expect((responseMessage as ExchangeResponseMessage).callingContext).to.deep.equal(requestMessage.callingContext);
            expect((responseMessage as ExchangeResponseMessage).response).to.deep.equal(response);
        }
    });    

    it('handles direct request with asynchronous handler response', async () => {

        // Arrange

        let actualPublishInput: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            actualPublishInput = params;
            callback(null, {
                MessageId: 'MessageId'
            });
        });
        
        const request: TestRequest = { input: 666 };
        const response = new AsyncResponse('flowCorrelationId', 'instanceId', [], 'requestId');

        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .addInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): AsyncResponse => response;
            });
        const sns = new AWS.SNS();
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {
            publisher.resources.exchangeTopic = 
                new SNSPublishMessageResource(undefined, new ConstantValue(exchangeTopicArn), sns);
        });

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const requestMessage: ExchangeRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                handlerTypeName: 'handlerTypeName',
                requestId: 'requestId'
            },
            request: request
        };

        let functionInstance: FunctionInstance | undefined;

        flowInstanceRepository.store(Arg.is((fi: FunctionInstance) => {
            functionInstance = fi;
            return true;
        }));
            
        // Act

        const responseMessage = await lambdaHandlerSut.handle(TestActivityRequestHandler, requestMessage);
        
        // Assert
        
        expect(responseMessage).to.not.be.undefined;

        if (responseMessage !== undefined) {
            expect((responseMessage as ExchangeResponseMessage).callingContext).to.deep.equal(requestMessage.callingContext);
            expect((responseMessage as ExchangeResponseMessage).response.AsyncResponse).to.be.true;
        }

        expect(functionInstance).to.not.be.undefined;

        if (functionInstance !== undefined) {
            expect(functionInstance.callingContext).to.deep.equal(requestMessage.callingContext);
            expect(functionInstance.flowInstance.correlationId).to.equal(requestMessage.callingContext.flowCorrelationId);
            expect(functionInstance.resumeCount).to.equal(0);
        }
    });    
});

function getSNSEvent(snsFlowMessage: any): SNSEvent {
    return {
        'Records': [
            {
                'EventSource': 'aws:sns',
                'EventVersion': '1.0',
                'EventSubscriptionArn': 'arn:aws:sns:eu-west-2:{{{accountId}}}:ExampleTopic',
                'Sns': {
                    'Type': 'Notification',
                    'MessageId': '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
                    'TopicArn': 'arn:aws:sns:eu-west-2:123456789012:ExampleTopic',
                    'Subject': 'example subject',
                    'Message': JSON.stringify(snsFlowMessage),
                    'Timestamp': '1970-01-01T00:00:00.000Z',
                    'SignatureVersion': '1',
                    'Signature': 'EXAMPLE',
                    'SigningCertUrl': 'EXAMPLE',
                    'UnsubscribeUrl': 'EXAMPLE',
                    'MessageAttributes': {}
                }
            }
        ]
    };
}
