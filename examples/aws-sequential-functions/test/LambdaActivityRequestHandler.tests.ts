import { IActivityRequestHandler, FlowContext, AsyncResponse, RequestRouter, HandlerFactory } from '../src/omahdog/FlowContext';
import { SNSEvent } from 'aws-lambda/trigger/sns';
import { AsyncRequestMessage, AsyncResponseMessage } from '../src/omahdog-aws/AsyncExchange';
import { LambdaActivityRequestHandler } from '../src/omahdog-aws/LambdaActivityRequestHandler';
import * as AWSMock from 'aws-sdk-mock';
import AWS, { AWSError, Request as AWSRequest } from 'aws-sdk';
import { IFunctionInstanceRepository, FunctionInstance } from '../src/omahdog-aws/IFunctionInstanceRepository';
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
    private readonly _response?: TestResponse | AsyncResponse;
    
    constructor(request?: TestRequest, response?: TestResponse | AsyncResponse) {
        this._request = request;
        this._response = response;
    }

    async handle(flowContext: FlowContext, request?: TestRequest): Promise<TestResponse | AsyncResponse> {                
        expect(request).to.deep.equal(this._request);
        if (this._response === undefined) throw new Error('this._response');
        return this._response;
    }    
}

describe('LambdaActivityRequestHandler tests', () => {

    beforeEach(() => {
        AWSMock.setSDKInstance(AWS);        
    });

    afterEach(() => {
        AWSMock.restore('SNS');
    });

    it('returns synchronous response', async () => {

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
            .register(TestActivityRequestHandler, () => new TestActivityRequestHandler(request, response));
        const sns = new AWS.SNS();        
        const exchangeTopicArn = 'exchangeTopicArn';
        const flowInstanceRepository = Substitute.for<IFunctionInstanceRepository>();

        const lambdaHandlerSut = 
            new LambdaActivityRequestHandler(
                TestActivityRequestHandler, requestRouter, handlerFactory, sns, exchangeTopicArn, flowInstanceRepository);

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

        await lambdaHandlerSut.handle(getSNSEvent(requestMessage));
        
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
