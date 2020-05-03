import { IExchangeMessagePublisher } from './IExchangeMessagePublisher';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import { AsyncResponseMessage, AsyncCallingContext, AsyncRequestMessage } from './AsyncExchange';

// TODO 03May20: Have a set of tests for this
export class SNSExchangeMessagePublisher implements IExchangeMessagePublisher {
    
    private readonly _sns: SNS;
    private readonly _exchangeTopicArn?: string;

    constructor (sns: SNS, exchangeTopicArn?: string) {
        this._sns = sns;
        this._exchangeTopicArn = exchangeTopicArn;
    }

    async publishRequest(requestTypeName: string, message: AsyncRequestMessage): Promise<void> {

        if (this._sns === undefined) throw new Error('this._sns');
        if (this._exchangeTopicArn === undefined) throw new Error('this._exchangeTopicArn === undefined');
        
        // const requestId = uuid.v4();
        
        // const message: AsyncRequestMessage = 
        //     {
        //         callingContext: {
        //             requestId: requestId,
        //             flowInstanceId: flowContext.instanceId,
        //             flowCorrelationId: flowContext.correlationId,
        //             flowTypeName: flowContext.rootStackFrame.flowTypeName
        //         },
        //         request: request
        //     };

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this._exchangeTopicArn,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${requestTypeName}:Handler` }
            }
        };
        
        const publishResponse = await this._sns.publish(params).promise();
    
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);
    }
    
    async publishResponse(flowTypeName: string, message: AsyncResponseMessage): Promise<void> {
    
        // const message: AsyncResponseMessage = 
        // {
        //     callingContext: callingContext,
        //     response: response
        // };

        console.log(`message: ${JSON.stringify(message)}`);

        if (this._sns === undefined) throw new Error('this._sns === undefined');
        if (this._exchangeTopicArn === undefined) throw new Error('this._exchangeTopicArn === undefined');

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this._exchangeTopicArn,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${flowTypeName}:Response` }
            }
        };
    
        const publishResponse = await this._sns.publish(params).promise();
        
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);    
    }
}