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

        // TODO 18Apr20: What else do we need to send?
        /*
        root flow name so we can be called back. Q. How do we know the root name?
        flowInstanceId
        requestId
        */

        const requestId = 'TODO';

        // TODO 18Apr20: Package the following up in a class
        
        const params = {
            Message: JSON.stringify({
                context: {
                    flowName: this._FlowType.name,
                    flowInstanceId: flowContext.instanceId,
                    requestId: requestId
                },
                request: request
            }),
            TopicArn: this._topicArn,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${this._RequestType.name}:Request` }
            }
        };
        
        const publishResponse = await this._sns.publish(params).promise();
    
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);

        return new AsyncResponse(requestId);
    }
}
