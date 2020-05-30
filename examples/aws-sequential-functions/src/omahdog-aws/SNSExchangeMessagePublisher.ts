import { IExchangeMessagePublisher } from './IExchangeMessagePublisher';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import { ExchangeResponseMessage, ExchangeCallingContext, ExchangeRequestMessage } from './Exchange';

// TODO 03May20: Have a set of tests for this
export class SNSExchangeMessagePublisher implements IExchangeMessagePublisher {
    
    private readonly sns?: SNS;
    private readonly exchangeTopicArn?: string;

    constructor (sns?: SNS, exchangeTopicArn?: string) {
        this.sns = sns;
        this.exchangeTopicArn = exchangeTopicArn;
    }

    async publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void> {

        console.log(`Publishing message to exchangeTopicArn: ${this.exchangeTopicArn}`);
        console.log(`message: ${JSON.stringify(message)}`);

        if (this.sns === undefined) throw new Error('this._sns');
        if (this.exchangeTopicArn === undefined) throw new Error('this._exchangeTopicArn === undefined');

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.exchangeTopicArn,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${requestTypeName}:Handler` }
            }
        };

        try {
            console.log(`params: ${JSON.stringify(params)}`);                
            const publishResponse = await this.sns.publish(params).promise();    
            console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);                
        } catch (error) {
            console.error('Error calling this.sns.publish: ' + error.message);
            throw new Error('Error calling this.sns.publish');
        }
    }
    
    async publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void> {

        console.log(`message: ${JSON.stringify(message)}`);

        if (this.sns === undefined) throw new Error('this.sns === undefined');
        if (this.exchangeTopicArn === undefined) throw new Error('this.exchangeTopicArn === undefined');

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.exchangeTopicArn,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${flowTypeName}:Response` }
            }
        };
    
        const publishResponse = await this.sns.publish(params).promise();
        
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);    
    }
}