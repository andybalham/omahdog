import { AddThreeNumbersRequest } from '../src/exchanges/AddThreeNumbersExchange';
import { SNSEvent } from 'aws-lambda';
import { AsyncRequestMessage } from '../src/omahdog-aws/AsyncExchange';

describe('handler tests', () => {

    it('adds up numbers', async () => {

        const request: AddThreeNumbersRequest = {
            a: 202, b: 202, c: 212
        };

        const snsFlowMessage: AsyncRequestMessage = {
            callingContext: {
                flowCorrelationId: 'flowCorrelationId',
                flowInstanceId: 'flowInstanceId',
                handlerTypeName: 'handlerTypeName',
                requestId: 'requestId'
            },
            request: request
        };

        const snsFlowMessageJson = JSON.stringify(snsFlowMessage);

        console.log(snsFlowMessageJson);

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
        
        console.log(JSON.stringify(snsEvent));
        
        // await handler(snsEvent);
    });
});
