import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { PublishInput } from 'aws-sdk/clients/sns';
import { FlowResponseMessage, FlowRequestMessage } from './FlowMessage';
import { SNSPublishMessageService } from './AwsServices';

// TODO 03May20: Have a set of tests for this
export class SNSExchangeMessagePublisher implements IExchangeMessagePublisher {
    
    services = {
        exchangeTopic: new SNSPublishMessageService
    }

    constructor(initialise?: (resource: SNSExchangeMessagePublisher) => void) {
        if (initialise !== undefined) initialise(this);
    }
    
    async publishRequest(requestTypeName: string, message: FlowRequestMessage): Promise<void> {

        console.log(`Publishing message to exchangeTopicArn: ${this.getExchangeTopicArn()}`);
        console.log(`message: ${JSON.stringify(message)}`);

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.getExchangeTopicArn(),
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${requestTypeName}:Handler` }
            }
        };

        try {

            console.log(`params: ${JSON.stringify(params)}`);
            
            if (this.services.exchangeTopic.client === undefined) throw new Error('this.services.exchangeTopic.client === undefined');
            
            const publishResponse = await this.services.exchangeTopic.client.publish(params).promise();    
            
            console.log(`publishResponse.MessageId: ${publishResponse?.MessageId}`);

        } catch (error) {
            console.error('Error calling this.sns.publish: ' + error.message);
            throw new Error('Error calling this.sns.publish');
        }
    }

    async publishResponse(requesterId: string, message: FlowResponseMessage): Promise<void> {

        console.log(`message: ${JSON.stringify(message)}`);

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.getExchangeTopicArn(),
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${requesterId}:Response` }
            }
        };
    
        if (this.services.exchangeTopic.client === undefined) throw new Error('this.services.exchangeTopic.client === undefined');

        const publishResponse = await this.services.exchangeTopic.client.publish(params).promise();
        
        console.log(`publishResponse.MessageId: ${publishResponse?.MessageId}`);    
    }
    
    private getExchangeTopicArn(): string {
        return this.services.exchangeTopic.topicArn ?? 'undefined';
    }
}