import { SNSEvent } from 'aws-lambda';
import { AddThreeNumbersRequest } from './exchanges/AddThreeNumbersExchange';
import { FlowContext } from './omahdog/FlowContext';
import { FlowHandlers } from './omahdog/FlowHandlers';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SNSFlowMessage } from './omahdog-aws';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';

// class SumNumbersSNSHandler implements IActivityRequestHandler<SumNumbersRequest, SumNumbersResponse> {
    
//     async handle(flowContext: FlowContext, request: SumNumbersRequest, deps: any): Promise<SumNumbersResponse | undefined> {

//         const params = {
//             Message: JSON.stringify({
//                 context: context,
//                 body: request
//             }),
//             TopicArn: process.env.REQUEST_RESPONSE_TOPIC_ARN,
//             MessageAttributes: {
//                 MessageType: { DataType: 'String', StringValue: `${request.TYPE_NAME}:Request` }
//             }
//         };
        
//         const publishResponse = await deps.publish(params);
    
//         console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);

//         return undefined;
//     }
// }

const handlers = new FlowHandlers()
    .register(SumNumbersRequest, SumNumbersResponse, new SumNumbersHandler());
    
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
