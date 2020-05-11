import DynamoDB from 'aws-sdk/clients/dynamodb';
import SNS from 'aws-sdk/clients/sns';

import { RequestRouter, HandlerFactory } from './omahdog/FlowContext';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';
import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';
import { DeadLetterQueueHandler } from './omahdog-aws/DeadLetterQueueHandler';
import { ActivityRequestHandlerMessageProxy } from './omahdog-aws/ActivityRequestHandlerMessageProxy';
import { ActivityRequestHandlerLambdaProxy } from './omahdog-aws/ActivityRequestHandlerLambdaProxy';

import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { AddTwoNumbersRequest, AddTwoNumbersResponse } from './exchanges/AddTwoNumbersExchange';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';

// TODO 04May20: Is there any way we can lazy load these? What is the overhead of them being created for *each* function?

const documentClient = new DynamoDB.DocumentClient();
const sns = new SNS();

const exchangeMessagePublisher = new SNSExchangeMessagePublisher(sns, process.env.FLOW_EXCHANGE_TOPIC_ARN);

export class AddThreeNumbersHandlerLambdaProxy extends ActivityRequestHandlerLambdaProxy<AddThreeNumbersRequest, AddThreeNumbersResponse> {
    constructor() { super(process.env.ADD_THREE_NUMBERS_FUNCTION_NAME); }
}
export class AddThreeNumbersHandlerMessageProxy extends ActivityRequestHandlerMessageProxy<AddThreeNumbersRequest, AddThreeNumbersResponse> {
    constructor() { super(AddThreeNumbersRequest, AddThreeNumbersResponse, exchangeMessagePublisher); }
}

export class AddTwoNumbersHandlerLambdaProxy extends ActivityRequestHandlerLambdaProxy<AddTwoNumbersRequest, AddTwoNumbersResponse> {
    constructor() { super(process.env.ADD_TWO_NUMBERS_FUNCTION_NAME); }
}
export class AddTwoNumbersHandlerMessageProxy extends ActivityRequestHandlerMessageProxy<AddTwoNumbersRequest, AddTwoNumbersResponse> {
    constructor() { super(AddTwoNumbersRequest, AddTwoNumbersResponse, exchangeMessagePublisher); }
}

class SumNumbersHandlerLambdaProxy extends ActivityRequestHandlerLambdaProxy<SumNumbersRequest, SumNumbersResponse> {
    constructor() { super(process.env.SUM_NUMBERS_FUNCTION_NAME); }
}
class SumNumbersHandlerMessageProxy extends ActivityRequestHandlerMessageProxy<SumNumbersRequest, SumNumbersResponse> {
    constructor() { super(SumNumbersRequest, SumNumbersResponse, exchangeMessagePublisher); }
}

class StoreTotalHandlerLambdaProxy extends ActivityRequestHandlerLambdaProxy<StoreTotalRequest, StoreTotalResponse> {
    constructor() { super(process.env.STORE_TOTAL_FUNCTION_NAME); }
}
class StoreTotalHandlerMessageProxy extends ActivityRequestHandlerMessageProxy<StoreTotalRequest, StoreTotalResponse> {
    constructor() { super(StoreTotalRequest, StoreTotalResponse, exchangeMessagePublisher); }
}

export const requestRouter = new RequestRouter()
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandlerLambdaProxy)
    .register(StoreTotalRequest, StoreTotalResponse, StoreTotalHandlerLambdaProxy)
    ;

// export const requestRouter = new RequestRouter()
//     .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandlerMessageProxy)
//     .register(StoreTotalRequest, StoreTotalResponse, StoreTotalHandlerMessageProxy)
//     ;

export const handlerFactory = new HandlerFactory()
    .register(AddThreeNumbersHandler, () => new AddThreeNumbersHandler('Three numbers together'))    
    .register(AddTwoNumbersHandler, () => new AddTwoNumbersHandler('Two numbers together'))
    .register(StoreTotalHandler, () => new StoreTotalHandler(documentClient, process.env.FLOW_RESULT_TABLE_NAME))
    ;

const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(documentClient, process.env.FLOW_INSTANCE_TABLE_NAME);

export const lambdaActivityRequestHandlerInstance = 
    new LambdaActivityRequestHandler(
        requestRouter, handlerFactory, exchangeMessagePublisher, functionInstanceRepository);

export const deadLetterQueueHandlerInstance = new DeadLetterQueueHandler(exchangeMessagePublisher);
