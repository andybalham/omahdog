import { IActivityRequestHandler, FlowContext, AsyncResponse, RequestRouter, HandlerFactory, FlowInstance } from '../src/omahdog/FlowContext';
import { SNSEvent } from 'aws-lambda/trigger/sns';
import { ErrorResponse } from '../src/omahdog/FlowExchanges';
import { AsyncRequestMessage, AsyncResponseMessage } from '../src/omahdog-aws/AsyncExchange';
import { LambdaActivityRequestHandler } from '../src/omahdog-aws/LambdaActivityRequestHandler';
import * as AWSMock from 'aws-sdk-mock';
import AWS, { AWSError, Request as AWSRequest } from 'aws-sdk';
import { IFunctionInstanceRepository, FunctionInstance } from '../src/omahdog-aws/IFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from '../src/omahdog-aws/SNSExchangeMessagePublisher';
import SNS, { PublishInput, PublishResponse } from 'aws-sdk/clients/sns';
import { expect } from 'chai';
import { Substitute, Arg } from '@fluffy-spoon/substitute';

class TestRequest {
    input: number
}

class TestResponse {
    output: number
}

class TestActivityRequestHandler implements IActivityRequestHandler<TestRequest, TestResponse> {

    private readonly _request?: TestRequest;
    private readonly _response?: () => TestResponse | AsyncResponse;
    
    constructor(request?: TestRequest, response?: () => TestResponse | AsyncResponse) {
        this._request = request;
        this._response = response;
    }

    async handle(flowContext: FlowContext, request?: TestRequest): Promise<TestResponse | AsyncResponse> {                
        expect(request).to.deep.equal(this._request);
        if (this._response === undefined) throw new Error('this._response');
        return this._response();
    }    
}

describe('LambdaActivityRequestHandler tests', () => {

    beforeEach(() => {
        AWSMock.setSDKInstance(AWS);        
    });

    afterEach(() => {
        AWSMock.restore('SNS');
    });

    it('handles request with synchronous handler response', async () => {

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

        const requestRouter = new RequestRouter();
        const handlerFactory = new HandlerFactory()
            .register(TestActivityRequestHandler, () => new TestActivityRequestHandler(request, () => response));
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(sns, exchangeTopicArn);

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const requestMessage: AsyncRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                flowTypeName: 'flowTypeName',
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
            expect(actualPublishInput.MessageAttributes?.MessageType?.StringValue).to.equal('flowTypeName:Response');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as AsyncResponseMessage;

            expect(responseMessage.callingContext).to.deep.equal(requestMessage.callingContext);
            expect(responseMessage.response).to.deep.equal(response);
        }
    });    

    it('handles request with asynchronous handler response', async () => {

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

        const requestRouter = new RequestRouter();
        const handlerFactory = new HandlerFactory()
            .register(TestActivityRequestHandler, () => new TestActivityRequestHandler(request, () => response));
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(sns, exchangeTopicArn);

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const requestMessage: AsyncRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                flowTypeName: 'flowTypeName',
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

        const requestRouter = new RequestRouter();
        const handlerFactory = new HandlerFactory()
            .register(TestActivityRequestHandler, () => new TestActivityRequestHandler(undefined, () => response));
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(sns, exchangeTopicArn);
        
        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const responseMessage: AsyncResponseMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                flowTypeName: 'flowTypeName',
                requestId: 'asyncRequestId'
            },
            response: {}
        };

        const functionInstance: FunctionInstance = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'callingFlowInstanceId',
                flowTypeName: 'callingFlowTypeName',
                requestId: 'callingRequestId'
            },
            requestId: 'asyncRequestId',
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
            expect(actualPublishInput.MessageAttributes?.MessageType?.StringValue).to.equal('callingFlowTypeName:Response');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as AsyncResponseMessage;

            expect(responseMessage.callingContext).to.deep.equal(functionInstance.callingContext);
            expect(responseMessage.response).to.deep.equal(response);
        }

        flowInstanceRepository.received()
            .delete(Arg.is(v => v === 'flowInstanceId'));
    });    

    it('returns error response on error', async () => {

        // Arrange

        let actualPublishInput: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            actualPublishInput = params;
            callback(null, {
                MessageId: 'MessageId'
            });
        });
        
        const request: TestRequest = { input: 666 };

        const requestRouter = new RequestRouter();
        const handlerFactory = new HandlerFactory()
            .register(TestActivityRequestHandler, () => 
                new TestActivityRequestHandler(request, () => { throw new Error('Something went bandy!'); }));
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(sns, exchangeTopicArn);

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const requestMessage: AsyncRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                flowTypeName: 'flowTypeName',
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
            expect(actualPublishInput.MessageAttributes?.MessageType?.StringValue).to.equal('flowTypeName:Response');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as AsyncResponseMessage;

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
        
        const requestRouter = new RequestRouter();
        const handlerFactory = new HandlerFactory()
            .register(TestActivityRequestHandler, () => 
                new TestActivityRequestHandler(undefined, () => { throw new Error('Something went bandy!'); }));
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();
        // TODO 03May20: Mock out the IExchangeMessagePublisher
        const exchangeMessagePublisher = new SNSExchangeMessagePublisher(sns, exchangeTopicArn);

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                requestRouter, handlerFactory, exchangeMessagePublisher, flowInstanceRepository);

        const responseMessage: AsyncResponseMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                flowTypeName: 'flowTypeName',
                requestId: 'asyncRequestId'
            },
            response: {}
        };

        const functionInstance: FunctionInstance = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'callingFlowInstanceId',
                flowTypeName: 'callingFlowTypeName',
                requestId: 'callingRequestId'
            },
            requestId: 'asyncRequestId',
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
            expect(actualPublishInput.MessageAttributes?.MessageType?.StringValue).to.equal('callingFlowTypeName:Response');
    
            const responseMessage = JSON.parse(actualPublishInput.Message) as AsyncResponseMessage;

            expect(responseMessage.callingContext).to.deep.equal(functionInstance.callingContext);
            expect('ErrorResponse' in responseMessage.response, 'ErrorResponse').to.be.true;
            expect((responseMessage.response as ErrorResponse).message).to.equal('Something went bandy!');
        }

        flowInstanceRepository.received()
            .delete(Arg.is(v => v === 'flowInstanceId'));
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