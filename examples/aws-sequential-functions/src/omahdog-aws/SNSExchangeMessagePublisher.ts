import { IExchangeMessagePublisher } from './IExchangeMessagePublisher';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import { ExchangeResponseMessage, ExchangeCallingContext, ExchangeRequestMessage } from './Exchange';
import { SNSPublishMessageResource } from './AwsResources';

// TODO 03May20: Have a set of tests for this
export class SNSExchangeMessagePublisher implements IExchangeMessagePublisher {
    
    resources = {
        exchangeTopic: new SNSPublishMessageResource
    }

    constructor(initialise?: (resource: SNSExchangeMessagePublisher) => void) {
        if (initialise !== undefined) initialise(this);
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        this.resources.exchangeTopic.validate().forEach(message => 
            errorMessages.push(`${SNSExchangeMessagePublisher.name}: ${message}`));
        return errorMessages;
    }
    
    throwErrorIfInvalid(): void {
        const errorMessages = this.validate();
        if (errorMessages.length > 0) {
            throw new Error(`${SNSExchangeMessagePublisher.name} is not valid:\n${errorMessages.join('\n')}`);
        }
    }

    async publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void> {

        console.log(`Publishing message to exchangeTopicArn: ${this.getExchangeTopicArn()}`);
        console.log(`message: ${JSON.stringify(message)}`);

        this.throwErrorIfInvalid();

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.getExchangeTopicArn(),
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${requestTypeName}:Handler` }
            }
        };

        try {
            console.log(`params: ${JSON.stringify(params)}`);                
            const publishResponse = await this.resources.exchangeTopic.client?.publish(params).promise();    
            console.log(`publishResponse.MessageId: ${publishResponse?.MessageId}`);                
        } catch (error) {
            console.error('Error calling this.sns.publish: ' + error.message);
            throw new Error('Error calling this.sns.publish');
        }
    }

    async publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void> {

        console.log(`message: ${JSON.stringify(message)}`);

        this.throwErrorIfInvalid();

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.getExchangeTopicArn(),
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${flowTypeName}:Response` }
            }
        };
    
        const publishResponse = await this.resources.exchangeTopic.client?.publish(params).promise();
        
        console.log(`publishResponse.MessageId: ${publishResponse?.MessageId}`);    
    }
    
    private getExchangeTopicArn(): string {
        return this.resources.exchangeTopic.topicArn ?? 'undefined';
    }
}