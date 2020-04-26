import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/AWSUtils';
import { SNSActivityRequestHandler } from './omahdog-aws/SNSActivityRequestHandler';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { RequestRouter, HandlerFactory } from './omahdog/FlowContext';

export const flowExchangeTopic = process.env.FLOW_EXCHANGE_TOPIC_ARN;

export const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(process.env.FLOW_INSTANCE_TABLE_NAME);

// TODO 25Apr20: Move this with the in-process handler?
class SumNumbersSNSHandler extends SNSActivityRequestHandler<SumNumbersRequest, SumNumbersResponse> {
    constructor(topicArn?: string) { super(SumNumbersRequest, SumNumbersResponse, topicArn); }
}

export const requestRouter = new RequestRouter()
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersSNSHandler)
    ;

export const handlerFactory = new HandlerFactory()
    .register(AddThreeNumbersHandler, () => new AddThreeNumbersHandler('Bigly number'))
    .register(SumNumbersHandler, () => new SumNumbersHandler)
    .register(SumNumbersSNSHandler, () => new SumNumbersSNSHandler(flowExchangeTopic))
    ;