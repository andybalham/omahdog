import { SNSEvent } from 'aws-lambda';
import { AddThreeNumbersRequest } from './exchanges/AddThreeNumbersExchange';
import { FlowContext } from './omahdog/FlowContext';
import { FlowHandlers, IActivityRequestHandler } from './omahdog/FlowHandlers';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SNSFlowMessage } from './omahdog-aws';

class SNSHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    private readonly _RequestType: new() => TReq;
    private readonly _deps: any;

    constructor(RequestType: new() => TReq, deps: any) {
        this._RequestType = RequestType;
        this._deps = deps;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | undefined> {

        const params = {
            Message: JSON.stringify({
                context: flowContext,
                body: request
            }),
            TopicArn: process.env.REQUEST_RESPONSE_TOPIC_ARN,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${this._RequestType.name}:Request` }
            }
        };
        
        const publishResponse = await this._deps.publish(params);
    
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);

        return undefined;
    }
}

const handlers = new FlowHandlers()
    .register(SumNumbersRequest, SumNumbersResponse, new SNSHandler<SumNumbersRequest, SumNumbersResponse>(SumNumbersRequest, {}));
    
export const handler = async (event: SNSEvent): Promise<void> => {

    const snsMessage = event.Records[0].Sns;    
    // TODO 14Apr20: Check snsMessage.MessageAttributes
    const message = JSON.parse(snsMessage.Message) as SNSFlowMessage;    
    const request = message.body as AddThreeNumbersRequest;

    const flowContext = new FlowContext();
    flowContext.handlers = handlers;

    const response = await new AddThreeNumbersHandler().handle(flowContext, request);

    console.log(`response: ${JSON.stringify(response)}`);
};
