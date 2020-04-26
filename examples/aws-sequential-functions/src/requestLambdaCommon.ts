import { RequestRouter, HandlerFactory } from './omahdog/FlowContext';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';

import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { SumNumbersHandler, SumNumbersSNSHandler } from './handlers/SumNumbersHandler';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { StoreTotalSNSHandler, StoreTotalHandler } from './handlers/StoreTotalHandler';
import DynamoDB from 'aws-sdk/clients/dynamodb';

export const flowExchangeTopic = process.env.FLOW_EXCHANGE_TOPIC_ARN;
export const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(process.env.FLOW_INSTANCE_TABLE_NAME);

const dynamoDbClient = new DynamoDB.DocumentClient();

export const requestRouter = new RequestRouter()
    .register(AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersHandler)
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersSNSHandler)
    .register(StoreTotalRequest, StoreTotalResponse, StoreTotalSNSHandler)
    ;

export const handlerFactory = new HandlerFactory()
    .register(AddThreeNumbersHandler, () => new AddThreeNumbersHandler('Bigly number'))
    .register(SumNumbersHandler, () => new SumNumbersHandler)
    .register(SumNumbersSNSHandler, () => new SumNumbersSNSHandler(flowExchangeTopic))
    .register(StoreTotalHandler, () => new StoreTotalHandler(dynamoDbClient, process.env.FLOW_RESULT_TABLE_NAME))
    .register(StoreTotalSNSHandler, () => new StoreTotalSNSHandler(flowExchangeTopic))
    ;