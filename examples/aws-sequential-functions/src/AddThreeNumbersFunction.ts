import { SNSEvent } from 'aws-lambda';
import { AddThreeNumbersRequest } from './exchanges/AddThreeNumbersExchange';
import { FlowContext } from './omahdog/FlowContext';
import { FlowHandlers } from './omahdog/FlowHandlers';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SNSFlowMessage } from './omahdog-aws';

const handlers = new FlowHandlers()
    .register(SumNumbersRequest, SumNumbersResponse, new SumNumbersHandler());
    
export const handler = async (event: SNSEvent): Promise<void> => {

    const snsMessage = event.Records[0].Sns;    
    // TODO 14Apr20: Check snsMessage.MessageAttributes
    const message = JSON.parse(snsMessage.Message) as SNSFlowMessage;    
    const request = message.body as AddThreeNumbersRequest;

    const flowContext = new FlowContext();
    flowContext.handlers = handlers;

    const response = new AddThreeNumbersHandler().handle(flowContext, request);

    console.log(`response: ${JSON.stringify(response)}`);
};
