import { IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowHandlers';
import { FlowContext } from '../omahdog/FlowContext';
import AWS from 'aws-sdk';
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

        const asyncResponse = new AsyncResponse();
        
        const message: AsyncRequestMessage = 
            {
                context: {
                    requestId: asyncResponse.requestId,
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

        return asyncResponse;
    }
}

export class AsyncRequestMessage {
    readonly context: AsyncRequestContext;
    readonly request: any;
}

export class AsyncRequestContext {
    readonly requestId: string;
    readonly flowTypeName: string;
    readonly flowInstanceId: string;
}

export class AsyncResponseMessage {
    readonly context: AsyncResponseContext;
    readonly response: any;
}

export class AsyncResponseContext {
    readonly requestId: string;
    readonly flowInstanceId: string;
}