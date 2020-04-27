import { IActivityRequestHandler, FlowContext, AsyncResponse, RequestRouter, HandlerFactory } from '../src/omahdog/FlowContext';
import { SNSEvent } from 'aws-lambda/trigger/sns';
import { AsyncRequestMessage } from '../src/omahdog-aws/AsyncExchange';
import { LambdaActivityRequestHandler } from '../src/omahdog-aws/LambdaActivityRequestHandler';
import * as AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { IFunctionInstanceRepository, FunctionInstance } from '../src/omahdog-aws/IFunctionInstanceRepository';
import { PublishInput } from 'aws-sdk/clients/sns';
import { expect } from 'chai';

class TestRequest {
}

class TestResponse {
    output: number
}

class TestActivityRequestHandler implements IActivityRequestHandler<TestRequest, TestResponse> {

    private readonly _response?: TestResponse | AsyncResponse;
    
    constructor(response?: TestResponse | AsyncResponse) {
        this._response = response;
    }

    async handle(flowContext: FlowContext, request?: TestRequest): Promise<TestResponse | AsyncResponse> {
        if (this._response === undefined) throw new Error('this._response');
        return this._response;
    }    
}

class MockFlowInstanceRepository implements IFunctionInstanceRepository {
    async store(instance: FunctionInstance): Promise<void> {
        throw new Error('Method not implemented.');
    }
    async retrieve(instanceId: string): Promise<FunctionInstance> {
        throw new Error('Method not implemented.');
    }
    async delete(instanceId: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
}

describe('LambdaActivityRequestHandler tests', () => {

    it('returns synchronous response', async () => {

        const snsFlowMessage: AsyncRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                flowTypeName: 'flowTypeName',
                requestId: 'requestId'
            },
            request: new TestRequest()
        };

        const snsFlowMessageJson = JSON.stringify(snsFlowMessage);
        
        const snsEvent: SNSEvent = {
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
                        'Message': snsFlowMessageJson,
                        'Timestamp': '1970-01-01T00:00:00.000Z',
                        'SignatureVersion': '1',
                        'Signature': 'EXAMPLE',
                        'SigningCertUrl': 'EXAMPLE',
                        'UnsubscribeUrl': 'EXAMPLE',
                        'MessageAttributes': {
                        }
                    }
                }
            ]
        };

        const response: TestResponse = { output: 616 };

        const requestRouter = new RequestRouter();
        const handlerFactory = new HandlerFactory()
            .register(TestActivityRequestHandler, () => new TestActivityRequestHandler(response));
        const flowInstanceRepository = new MockFlowInstanceRepository();
        
        AWSMock.setSDKInstance(AWS);
        
        let publishedParams: PublishInput | undefined = undefined;

        AWSMock.mock('SNS', 'publish', (params: PublishInput, callback: Function) => {
            publishedParams = params;
            callback(null, {});
        });
        
        const sns = new AWS.SNS({apiVersion: '2012-08-10'});
        
        const flowExchangeTopic = 'flowExchangeTopic';

        const lambdaHandler = 
            new LambdaActivityRequestHandler(TestActivityRequestHandler, requestRouter, handlerFactory, sns, flowExchangeTopic, flowInstanceRepository);
    
        await lambdaHandler.handle(snsEvent);

        AWSMock.restore('SNS');

        expect(publishedParams).to.not.be.undefined;
    });    
});