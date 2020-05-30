import { RequestRouter } from './omahdog/FlowContext';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy } from './lambdaProxies';
import { SumNumbersMessageProxy, StoreTotalMessageProxy } from './messageProxies';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { LambdaProxyRequestHandler } from './omahdog-aws/LambdaProxyRequestHandler';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { ResourceReference, EnvironmentVariable } from './omahdog-aws/SAMTemplate';
import { DynamoDBCrudResource } from './omahdog-aws/AwsResources';

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
