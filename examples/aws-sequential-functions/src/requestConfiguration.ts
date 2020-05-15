import DynamoDB from 'aws-sdk/clients/dynamodb';

import { RequestRouter, HandlerFactory } from './omahdog/FlowContext';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy } from './lambdaProxies';
import { SumNumbersMessageProxy, StoreTotalMessageProxy } from './messageProxies';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { ActivityRequestLambdaProxy } from './omahdog-aws/ActivityRequestHandlerLambdaProxy';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';

// TODO 04May20: Is there any way we can lazy load these? What is the overhead of them being created for *each* function?

const documentClient = new DynamoDB.DocumentClient();

// export const requestRouter = new RequestRouter()
//     .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandler)
//     .register(StoreTotalRequest, StoreTotalResponse, StoreTotalHandler)
//     ;

export const requestRouter = new RequestRouter()
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersLambdaProxy)
    .register(StoreTotalRequest, StoreTotalResponse, StoreTotalLambdaProxy)
    ;

// export const requestRouter = new RequestRouter()
//     .register(SumNumbersRequest, SumNumbersResponse, SumNumbersMessageProxy)
//     .register(StoreTotalRequest, StoreTotalResponse, StoreTotalMessageProxy)
//     ;

export const handlerFactory = new HandlerFactory()
    .register(AddThreeNumbersHandler, () => new AddThreeNumbersHandler('Three numbers together'))    
    .register(AddTwoNumbersHandler, () => new AddTwoNumbersHandler('Two numbers together'))
    .register(StoreTotalHandler, () => new StoreTotalHandler(documentClient, process.env.FLOW_RESULT_TABLE_NAME))
    ;
    
    