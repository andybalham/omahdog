import AWS from 'aws-sdk';
import uuid = require('uuid');
import { IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowHandlers';
import { FlowContext } from '../omahdog/FlowContext';
import { PublishInput } from 'aws-sdk/clients/sns';
import { AsyncRequestMessage } from './AWSUtils';

const sns = new AWS.SNS();

export class SNSActivityRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    private readonly _RequestType: new() => TReq;
    private readonly _topicArn?: string;

    constructor(RequestType: new() => TReq, _ResponseType: new() => TRes, topicArn?: string) {

        this._RequestType = RequestType;
        this._topicArn = topicArn;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {

        if (this._topicArn === undefined) throw new Error('this._topicArn === undefined');
        
        const requestId = uuid.v4();
        
        const message: AsyncRequestMessage = 
            {
                callingContext: {
                    requestId: requestId,
                    flowInstanceId: flowContext.instanceId,
                    flowCorrelationId: flowContext.correlationId,
                    flowTypeName: flowContext.rootStackFrame.flowTypeName
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
        
        const publishResponse = await sns.publish(params).promise();
    
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);

        return flowContext.getAsyncResponse(requestId);
    }
}
