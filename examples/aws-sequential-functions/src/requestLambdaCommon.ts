import { RequestRouter, HandlerFactory } from './omahdog/FlowContext';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';

import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { SumNumbersHandler, SumNumbersSNSHandler } from './handlers/SumNumbersHandler';

export const flowExchangeTopic = process.env.FLOW_EXCHANGE_TOPIC_ARN;

export const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(process.env.FLOW_INSTANCE_TABLE_NAME);

export const requestRouter = new RequestRouter()
    .register(AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersHandler)
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersSNSHandler)
    ;

export const handlerFactory = new HandlerFactory()
    .register(AddThreeNumbersHandler, () => new AddThreeNumbersHandler('Bigly number'))
    .register(SumNumbersHandler, () => new SumNumbersHandler)
    .register(SumNumbersSNSHandler, () => new SumNumbersSNSHandler(flowExchangeTopic))
    ;