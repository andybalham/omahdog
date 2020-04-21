import AWS from 'aws-sdk';
import uuid = require('uuid');
import { IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowHandlers';
import { FlowContext } from '../omahdog/FlowContext';
import { FlowRequestHandlerBase } from '../omahdog/FlowRequestHandler';
import { PublishInput } from 'aws-sdk/clients/sns';

export class SNSActivityRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    private readonly _FlowType: new () => FlowRequestHandlerBase;
    private readonly _RequestType: new() => TReq;
    private readonly _sns: AWS.SNS;
    private readonly _topicArn?: string; // TODO 16Apr20: Make this mandatory?

    constructor(FlowType: new() => FlowRequestHandlerBase, RequestType: new() => TReq, sns: AWS.SNS, topicArn?: string) {

        this._FlowType = FlowType;
        this._RequestType = RequestType;
        this._sns = sns;
        this._topicArn = topicArn;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {

        const requestId = uuid.v4();
        
        const message: AsyncRequestMessage = 
            {
                context: {
                    requestId: requestId,
                    flowInstanceId: flowContext.instanceId,
                    flowTypeName: this._FlowType.name
                },
                request: request
            };

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this._topicArn,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${this._RequestType.name}:Handler` }
            }
        };
        
        const publishResponse = await this._sns.publish(params).promise();
    
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);

        return flowContext.getAsyncResponse(requestId);
    }
}

export class AsyncRequestMessage {
    readonly context: AsyncExchangeContext;
    readonly request: any;
}

export class AsyncResponseMessage {
    readonly context: AsyncExchangeContext;
    readonly response: any;
}

export class AsyncExchangeContext {
    readonly requestId: string;
    readonly flowTypeName: string;
    readonly flowInstanceId: string;
}
