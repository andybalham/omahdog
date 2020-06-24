import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { PublishInput } from 'aws-sdk/clients/sns';
import { ExchangeResponseMessage, ExchangeRequestMessage } from './Exchange';
import { SNSPublishMessageService } from './AwsServices';
import { throwErrorIfInvalid } from './samTemplateFunctions';

// TODO 03May20: Have a set of tests for this
export class SNSExchangeMessagePublisher implements IExchangeMessagePublisher {
    
    services = {
        exchangeTopic: new SNSPublishMessageService
    }

    constructor(initialise?: (resource: SNSExchangeMessagePublisher) => void) {
        if (initialise !== undefined) initialise(this);
    }
    
    async publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void> {

        console.log(`Publishing message to exchangeTopicArn: ${this.getExchangeTopicArn()}`);
        console.log(`message: ${JSON.stringify(message)}`);

        throwErrorIfInvalid(this, () => SNSExchangeMessagePublisher.name);

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.getExchangeTopicArn(),
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${requestTypeName}:Handler` }
            }
        };

        try {
            console.log(`params: ${JSON.stringify(params)}`);                
            const publishResponse = await this.services.exchangeTopic.client?.publish(params).promise();    
            console.log(`publishResponse.MessageId: ${publishResponse?.MessageId}`);                
        } catch (error) {
            console.error('Error calling this.sns.publish: ' + error.message);
            throw new Error('Error calling this.sns.publish');
        }
    }

    async publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void> {

        console.log(`message: ${JSON.stringify(message)}`);

        throwErrorIfInvalid(this, () => SNSExchangeMessagePublisher.name);

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.getExchangeTopicArn(),
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${flowTypeName}:Response` }
            }
        };
    
        const publishResponse = await this.services.exchangeTopic.client?.publish(params).promise();
        
        console.log(`publishResponse.MessageId: ${publishResponse?.MessageId}`);    
    }
    
    private getExchangeTopicArn(): string {
        return this.services.exchangeTopic.topicArn ?? 'undefined';
    }
}