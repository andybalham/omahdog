import { IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowHandlers';
import { FlowContext } from '../omahdog/FlowContext';
import AWS from 'aws-sdk';
import { FlowRequestHandlerBase } from '../omahdog/FlowRequestHandler';

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

        // TODO 18Apr20: Package the following up in a class
        
        const asyncResponse = new AsyncResponse();

        const params = {
            Message: JSON.stringify({
                context: {
                    asyncRequestId: asyncResponse.asyncRequestId,
                    flowTypeName: this._FlowType.name,
                    flowInstanceId: flowContext.instanceId,
                },
                request: request
            }),
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
