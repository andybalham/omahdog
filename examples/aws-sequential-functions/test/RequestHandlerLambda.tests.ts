import { IActivityRequestHandler, FlowContext, AsyncResponse, RequestRouter, HandlerFactory, CallContext } from '../src/omahdog/FlowContext';
import { SNSEvent } from 'aws-lambda/trigger/sns';
import { ErrorResponse } from '../src/omahdog/FlowExchanges';
import { FlowRequestMessage, FlowResponseMessage } from '../src/omahdog-aws/FlowMessage';
import { RequestHandlerLambda } from '../src/omahdog-aws/RequestHandlerLambda';
import * as AWSMock from 'aws-sdk-mock';
import AWS, { Request as AWSRequest } from 'aws-sdk';
import { FunctionInstance, IFunctionInstanceRepository } from '../src/omahdog-aws/FunctionInstanceRepository';
import { ResponseMessagePublisher } from '../src/omahdog-aws/ResponseMessagePublisher';
import { PublishInput } from 'aws-sdk/clients/sns';
import { expect } from 'chai';
import { Substitute, Arg } from '@fluffy-spoon/substitute';
import { IResumableRequestHandler } from '../src/omahdog/FlowRequestHandler';
import { SNSPublishMessageService } from '../src/omahdog-aws/AwsServices';
import { ConstantValue } from '../src/omahdog-aws/ConfigurationValues';
import { ResourceReference } from '../src/omahdog-aws/TemplateReferences';

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

describe('RequestHandlerLambda tests', () => {

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
            .setInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): TestResponse => response;
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher?
        const exchangeMessagePublisher = new ResponseMessagePublisher(publisher => {
            publisher.services.exchangeTopic = 
                new SNSPublishMessageService(undefined, sns, new ConstantValue(exchangeTopicArn));
        });

        const handlerLambdaSut = 
            new RequestHandlerLambda(new ResourceReference('HandlerFunction'), TestRequest, TestResponse, TestActivityRequestHandler, lambda => {
                lambda.services.responsePublisher = exchangeMessagePublisher;
                lambda.services.functionInstanceRepository = flowInstanceRepository;
            });

        const requestMessage: FlowRequestMessage = {
            callContext: {
                correlationId: 'correlationId'
            },
            callbackId: 'callbackId',
            requestId: 'requestId',            
            request: request
        };
            
        // Act

        await handlerLambdaSut.handle(getSNSEvent(requestMessage), requestRouter, handlerFactory);
        
        // Assert
        
        expect(actualPublishInput).to.not.be.undefined;

        if (actualPublishInput !== undefined) {

            actualPublishInput = actualPublishInput as PublishInput;

            expect(actualPublishInput.TopicArn).to.equal(exchangeTopicArn);
            expect(actualPublishInput.MessageAttributes?.CallbackId?.DataType).to.equal('String');
            expect(actualPublishInput.MessageAttributes?.CallbackId?.StringValue).to.equal('callbackId');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as FlowResponseMessage;

            expect(responseMessage.requestId).to.equal(requestMessage.requestId);
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
        
        const callContext: CallContext = {
            correlationId: 'flowCorrelationId'
        };

        const request: TestRequest = { input: 666 };
        const response = new AsyncResponse([], 'asyncRequestId');

        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .setInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): AsyncResponse => response;
            });
        const sns = new AWS.SNS();
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new ResponseMessagePublisher(publisher => {
            publisher.services.exchangeTopic = 
                new SNSPublishMessageService(undefined, sns, new ConstantValue(exchangeTopicArn));
        });

        const handlerLambdaSut = 
            new RequestHandlerLambda(new ResourceReference('HandlerFunction'), TestRequest, TestResponse, TestActivityRequestHandler, lambda => {
                lambda.services.responsePublisher = exchangeMessagePublisher;
                lambda.services.functionInstanceRepository = flowInstanceRepository;
            });
    
        const requestMessage: FlowRequestMessage = {
            callContext: callContext,
            callbackId: 'callbackId',
            requestId: 'requestId',            
            request: request
        };

        let functionInstanceKey: string | undefined;
        let functionInstance: FunctionInstance | undefined;

        flowInstanceRepository.store(
            Arg.is((id: string) => {
                functionInstanceKey = id;
                return true;
            }), 
            Arg.is((fi: FunctionInstance) => {
                functionInstance = fi;
                return true;
            })
        );
            
        // Act

        await handlerLambdaSut.handle(getSNSEvent(requestMessage), requestRouter, handlerFactory);
        
        // Assert
        
        expect(actualPublishInput).to.be.undefined;

        expect(functionInstance).to.not.be.undefined;

        if (functionInstance !== undefined) {
            expect(functionInstanceKey).to.equal('asyncRequestId');
            expect(functionInstance.callContext.correlationId).to.equal(requestMessage.callContext.correlationId);
            expect(functionInstance.callbackId).to.equal(requestMessage.callbackId);
            expect(functionInstance.requestId).to.equal(requestMessage.requestId);
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
            .setInitialiser(TestActivityRequestHandler, handler => {
                handler.response = (): TestResponse => response;
            });

        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new ResponseMessagePublisher(publisher => {
            publisher.services.exchangeTopic = 
                new SNSPublishMessageService(undefined, sns, new ConstantValue(exchangeTopicArn));
        });
        
        const handlerLambdaSut = 
            new RequestHandlerLambda(new ResourceReference('HandlerFunction'), TestRequest, TestResponse, TestActivityRequestHandler, lambda => {
                lambda.services.responsePublisher = exchangeMessagePublisher;
                lambda.services.functionInstanceRepository = flowInstanceRepository;
            });

        const responseMessage: FlowResponseMessage = {
            requestId: 'asyncRequestId',
            response: {}
        };

        const callContext: CallContext = {
            correlationId: 'correlationId'
        };

        const functionInstance: FunctionInstance = {
            callContext: callContext,
            callbackId: 'callbackId',
            requestId: 'requestId',
            stackFrames: [],
            resumeCount: 0
        };

        flowInstanceRepository
            .retrieve(Arg.is(v => v === 'asyncRequestId'))
            .resolves(functionInstance);

        // Act

        await handlerLambdaSut.handle(getSNSEvent(responseMessage), requestRouter, handlerFactory);
        
        // Assert
        
        expect(actualPublishInput).to.not.be.undefined;

        if (actualPublishInput !== undefined) {

            actualPublishInput = actualPublishInput as PublishInput;

            expect(actualPublishInput.TopicArn).to.equal(exchangeTopicArn);
            expect(actualPublishInput.MessageAttributes?.CallbackId?.DataType).to.equal('String');
            expect(actualPublishInput.MessageAttributes?.CallbackId?.StringValue).to.equal('callbackId');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as FlowResponseMessage;

            expect(responseMessage.requestId).to.equal(functionInstance.requestId);
            expect(responseMessage.response).to.deep.equal(response);
        }
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
            .setInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): TestResponse => {throw new Error('Something went bandy!');};
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new ResponseMessagePublisher(publisher => {
            publisher.services.exchangeTopic = 
                new SNSPublishMessageService(undefined, sns, new ConstantValue(exchangeTopicArn));
        });

        const handlerLambdaSut = 
            new RequestHandlerLambda(new ResourceReference('HandlerFunction'), TestRequest, TestResponse, TestActivityRequestHandler, lambda => {
                lambda.services.responsePublisher = exchangeMessagePublisher;
                lambda.services.functionInstanceRepository = flowInstanceRepository;
            });

        const callContext: CallContext = {
            correlationId: 'flowCorrelationId'
        };
    
        const requestMessage: FlowRequestMessage = {
            callContext: callContext,
            callbackId: 'callbackId',
            requestId: 'requestId',            
            request: request
        };
                
        // Act

        await handlerLambdaSut.handle(getSNSEvent(requestMessage), requestRouter, handlerFactory);
        
        // Assert
        
        expect(actualPublishInput).to.not.be.undefined;

        if (actualPublishInput !== undefined) {

            actualPublishInput = actualPublishInput as PublishInput;

            expect(actualPublishInput.TopicArn).to.equal(exchangeTopicArn);
            expect(actualPublishInput.MessageAttributes?.CallbackId?.DataType).to.equal('String');
            expect(actualPublishInput.MessageAttributes?.CallbackId?.StringValue).to.equal('callbackId');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as FlowResponseMessage;

            expect(responseMessage.requestId).to.equal(requestMessage.requestId);
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
            .setInitialiser(TestActivityRequestHandler, handler => {
                handler.response = (): TestResponse => {throw new Error('Something went bandy!');};
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new ResponseMessagePublisher(publisher => {
            publisher.services.exchangeTopic = 
                new SNSPublishMessageService(undefined, sns, new ConstantValue(exchangeTopicArn));
        });

        const handlerLambdaSut = 
            new RequestHandlerLambda(new ResourceReference('HandlerFunction'), TestRequest, TestResponse, TestActivityRequestHandler, lambda => {
                lambda.services.responsePublisher = exchangeMessagePublisher;
                lambda.services.functionInstanceRepository = flowInstanceRepository;
            });

        const responseMessage: FlowResponseMessage = {
            requestId: 'asyncRequestId',
            response: {}
        };

        const callContext: CallContext = {
            correlationId: 'correlationId'
        };

        const functionInstance: FunctionInstance = {
            callContext: callContext,
            callbackId: 'callbackId',
            requestId: 'requestId',
            stackFrames: [],
            resumeCount: 0
        };

        flowInstanceRepository
            .retrieve(Arg.is(v => v === responseMessage.requestId))
            .resolves(functionInstance);

        // Act

        await handlerLambdaSut.handle(getSNSEvent(responseMessage), requestRouter, handlerFactory);
        
        // Assert
        
        expect(actualPublishInput).to.not.be.undefined;

        if (actualPublishInput !== undefined) {

            actualPublishInput = actualPublishInput as PublishInput;

            expect(actualPublishInput.TopicArn).to.equal(exchangeTopicArn);
            expect(actualPublishInput.MessageAttributes?.CallbackId?.DataType).to.equal('String');
            expect(actualPublishInput.MessageAttributes?.CallbackId?.StringValue).to.equal('callbackId');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as FlowResponseMessage;

            expect(responseMessage.requestId).to.equal(functionInstance.requestId);
            expect('ErrorResponse' in responseMessage.response, 'ErrorResponse').to.be.true;
            expect((responseMessage.response as ErrorResponse).message).to.equal('Something went bandy!');
        }
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
            .setInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): TestResponse => response;
            });
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new ResponseMessagePublisher(publisher => {
            publisher.services.exchangeTopic = 
                new SNSPublishMessageService(undefined, sns, new ConstantValue(exchangeTopicArn));
        });

        const handlerLambdaSut = 
            new RequestHandlerLambda(new ResourceReference('HandlerFunction'), TestRequest, TestResponse, TestActivityRequestHandler, lambda => {
                lambda.services.responsePublisher = exchangeMessagePublisher;
                lambda.services.functionInstanceRepository = flowInstanceRepository;
            });

        const callContext: CallContext = {
            correlationId: 'flowCorrelationId'
        };
        
        const requestMessage: FlowRequestMessage = {
            callContext: callContext,
            requestId: 'requestId',            
            request: request
        };
            
        // Act

        const handlerResponse = await handlerLambdaSut.handle(requestMessage, requestRouter, handlerFactory);
        
        // Assert
        
        expect(actualPublishInput).to.be.undefined;
        expect(handlerResponse).to.deep.equal(response);
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
        
        const callContext: CallContext = {
            correlationId: 'correlationId'
        };

        const request: TestRequest = { input: 666 };
        const response = new AsyncResponse([], 'asyncRequestId');

        const requestRouter = new RequestRouter()
            .register(TestRequest, TestResponse, TestActivityRequestHandler);
        const handlerFactory = new HandlerFactory()
            .setInitialiser(TestActivityRequestHandler, handler => {
                handler.request = request;
                handler.response = (): AsyncResponse => response;
            });
        const sns = new AWS.SNS();
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new ResponseMessagePublisher(publisher => {
            publisher.services.exchangeTopic = 
                new SNSPublishMessageService(undefined, sns, new ConstantValue(exchangeTopicArn));
        });

        const handlerLambdaSut = 
            new RequestHandlerLambda(new ResourceReference('HandlerFunction'), TestRequest, TestResponse, TestActivityRequestHandler, lambda => {
                lambda.services.responsePublisher = exchangeMessagePublisher;
                lambda.services.functionInstanceRepository = flowInstanceRepository;
            });
        
        const requestMessage: FlowRequestMessage = {
            callContext: callContext,
            requestId: 'requestId',            
            request: request
        };

        let functionInstanceKey: string | undefined;
        let functionInstance: FunctionInstance | undefined;

        flowInstanceRepository.store(
            Arg.is((id: string) => {
                functionInstanceKey = id;
                return true;
            }), 
            Arg.is((fi: FunctionInstance) => {
                functionInstance = fi;
                return true;
            })
        );
            
        // Act

        const responseMessage = await handlerLambdaSut.handle(requestMessage, requestRouter, handlerFactory);
        
        // Assert

        // TODO 02Aug20: What should happen here? Should we expect an error response as we didn't supply a callbackId?

        expect(responseMessage).to.not.be.undefined;

        expect(functionInstance).to.not.be.undefined;

        if (functionInstance !== undefined) {
            expect(functionInstanceKey).to.equal(response.requestId);
            expect(functionInstance.callContext).to.deep.equal(requestMessage.callContext);
            expect(functionInstance.callbackId).to.equal(requestMessage.callbackId);
            expect(functionInstance.requestId).to.equal(requestMessage.requestId);
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
