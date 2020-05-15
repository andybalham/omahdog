import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersRequest, AddTwoNumbersResponse } from './exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { ActivityRequestLambdaProxy } from './omahdog-aws/ActivityRequestHandlerLambdaProxy';

export class AddThreeNumbersLambdaProxy extends ActivityRequestLambdaProxy<AddThreeNumbersRequest, AddThreeNumbersResponse> {
    constructor() { super(process.env.ADD_THREE_NUMBERS_FUNCTION_NAME); }
}

export class AddTwoNumbersLambdaProxy extends ActivityRequestLambdaProxy<AddTwoNumbersRequest, AddTwoNumbersResponse> {
    constructor() { super(process.env.ADD_TWO_NUMBERS_FUNCTION_NAME); }
}

export class SumNumbersLambdaProxy extends ActivityRequestLambdaProxy<SumNumbersRequest, SumNumbersResponse> {
    constructor() { super(process.env.SUM_NUMBERS_FUNCTION_NAME); }
}

export class StoreTotalLambdaProxy extends ActivityRequestLambdaProxy<StoreTotalRequest, StoreTotalResponse> {
    constructor() { super(process.env.STORE_TOTAL_FUNCTION_NAME); }
}
