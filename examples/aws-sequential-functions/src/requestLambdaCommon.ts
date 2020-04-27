import DynamoDB from 'aws-sdk/clients/dynamodb';
import SNS from 'aws-sdk/clients/sns';

import { RequestRouter, HandlerFactory } from './omahdog/FlowContext';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';

import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersSNSHandler, StoreTotalSNSHandler } from './snsActivityRequestHandlers';

const documentClient = new DynamoDB.DocumentClient();
const sns = new SNS();

export const flowExchangeTopic = process.env.FLOW_EXCHANGE_TOPIC_ARN;
export const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(documentClient, process.env.FLOW_INSTANCE_TABLE_NAME);

export const requestRouter = new RequestRouter()
    .register(AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersHandler)
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersSNSHandler)
    .register(StoreTotalRequest, StoreTotalResponse, StoreTotalSNSHandler)
    ;

export const handlerFactory = new HandlerFactory()
    .register(AddThreeNumbersHandler, () => new AddThreeNumbersHandler('Bigly number'))
    .register(SumNumbersHandler, () => new SumNumbersHandler)
    .register(SumNumbersSNSHandler, () => new SumNumbersSNSHandler(sns, flowExchangeTopic))
    .register(StoreTotalHandler, () => new StoreTotalHandler(documentClient, process.env.FLOW_RESULT_TABLE_NAME))
    .register(StoreTotalSNSHandler, () => new StoreTotalSNSHandler(sns, flowExchangeTopic))
    ;
