import { SNSEvent } from 'aws-lambda';
import { AsyncRequestMessage, AsyncResponseMessage } from './omahdog-aws/AsyncExchange';
import { ErrorResponse } from './omahdog/FlowExchanges';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';

// TODO 01May20: Package this up as a class for easy use in a host application
const sns = new SNS();

export const flowExchangeTopic = process.env.FLOW_EXCHANGE_TOPIC_ARN;

export const handler = async (event: SNSEvent): Promise<void> => {

    try {

        const snsMessage = event.Records[0].Sns;

        console.log(JSON.stringify(snsMessage));
    
        const deadEvent: SNSEvent = JSON.parse(snsMessage.Message);

        const deadSnsMessage = deadEvent.Records[0].Sns;

        const deadMessage: AsyncRequestMessage | AsyncResponseMessage = JSON.parse(deadSnsMessage.Message);

        if ('request' in deadMessage) {

            const logEntry = {
                MessageAttributes: deadSnsMessage.MessageAttributes,
                MessageContext: deadMessage.callingContext,
                Request: deadMessage.request
            };
    
            console.log(JSON.stringify(logEntry));

            const callingContext = deadMessage.callingContext;

            const response: ErrorResponse = {
                ErrorResponse: true,
                name: 'Error',
                message: snsMessage.MessageAttributes.ErrorMessage.Value
            };

            const responseMessage: AsyncResponseMessage = 
                {
                    callingContext: callingContext,
                    response: response
                };
    
            console.log(`responseMessage: ${JSON.stringify(responseMessage)}`);
    
            const params: PublishInput = {
                Message: JSON.stringify(responseMessage),
                TopicArn: flowExchangeTopic,
                MessageAttributes: {
                    MessageType: { DataType: 'String', StringValue: `${callingContext.flowTypeName}:Response` }
                }
            };
            
            const publishResponse = await sns.publish(params).promise();
        
            console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);    
    
        } else if ('response' in deadMessage) {

            const logEntry = {
                MessageAttributes: deadSnsMessage.MessageAttributes,
                MessageContext: deadMessage.callingContext,
                Response: deadMessage.response
            };
    
            console.log(JSON.stringify(logEntry));

        } else {

            console.error(JSON.stringify(deadSnsMessage));

        }
        
    } catch (error) {
        console.error(`error.message: ${error.message}`);        
        console.error(`error.stack: ${error.stack}`);        
    }
};
