import { IResponseMessagePublisher } from './IResponseMessagePublisher';
import { PublishInput } from 'aws-sdk/clients/sns';
import { FlowResponseMessage, FlowRequestMessage } from './FlowMessage';
import { SNSPublishMessageService } from './AwsServices';

// TODO 03May20: Have a set of tests for this
export class ResponseMessagePublisher implements IResponseMessagePublisher {
    
    services = {
        exchangeTopic: new SNSPublishMessageService
    }

    constructor(initialise?: (resource: ResponseMessagePublisher) => void) {
        if (initialise !== undefined) initialise(this);
    }

    async publishResponse(callbackId: string, message: FlowResponseMessage): Promise<void> {

        console.log(`message: ${JSON.stringify(message)}`);

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.getExchangeTopicArn(),
            MessageAttributes: {
                CallbackId: { DataType: 'String', StringValue: `${callbackId}` }
            }
        };
    
        console.log(`publishResponse params: ${JSON.stringify(params)}`);

        if (this.services.exchangeTopic.client === undefined) throw new Error('this.services.exchangeTopic.client === undefined');

        const publishResponse = await this.services.exchangeTopic.client.publish(params).promise();
        
        console.log(`publishResponse.MessageId: ${publishResponse?.MessageId}`);    
    }
    
    private getExchangeTopicArn(): string {
        return this.services.exchangeTopic.topicArn ?? 'undefined';
    }
}