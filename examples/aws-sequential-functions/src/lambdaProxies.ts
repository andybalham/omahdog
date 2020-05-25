import { LambdaProxyRequestHandler } from './omahdog-aws/LambdaProxyRequestHandler';

import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersRequest, AddTwoNumbersResponse } from './exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';

export class AddThreeNumbersLambdaProxy extends LambdaProxyRequestHandler<AddThreeNumbersRequest, AddThreeNumbersResponse> {}
export class AddTwoNumbersLambdaProxy extends LambdaProxyRequestHandler<AddTwoNumbersRequest, AddTwoNumbersResponse> {}
export class SumNumbersLambdaProxy extends LambdaProxyRequestHandler<SumNumbersRequest, SumNumbersResponse> {}
export class StoreTotalLambdaProxy extends LambdaProxyRequestHandler<StoreTotalRequest, StoreTotalResponse> {}
