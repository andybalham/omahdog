import { RequestRouter } from './omahdog/FlowContext';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy } from './lambdaProxies';
import { SumNumbersMessageProxy, StoreTotalMessageProxy } from './messageProxies';

// export const requestRouter = new RequestRouter()
//     .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandler)
//     .register(StoreTotalRequest, StoreTotalResponse, StoreTotalHandler)
//     ;

// export const requestRouter = new RequestRouter()
//     .register(SumNumbersRequest, SumNumbersResponse, SumNumbersLambdaProxy)
//     .register(StoreTotalRequest, StoreTotalResponse, StoreTotalLambdaProxy)
//     ;

// export const requestRouter = new RequestRouter()
//     .register(SumNumbersRequest, SumNumbersResponse, SumNumbersMessageProxy)
//     .register(StoreTotalRequest, StoreTotalResponse, StoreTotalMessageProxy)
//     ;

export const requestRouter = new RequestRouter()
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersLambdaProxy)
    .register(StoreTotalRequest, StoreTotalResponse, StoreTotalMessageProxy)
    ;
