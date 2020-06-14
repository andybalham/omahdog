import { ApiControllerRoutes, StringParameters } from './omahdog-aws/ApiControllerLambda';

import { AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy, AddThreeNumbersMessageProxy, AddTwoNumbersMessageProxy, SumNumbersLambdaProxy, StoreTotalMessageProxy } from './handlerProxies';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersResponse, AddTwoNumbersRequest } from './exchanges/AddTwoNumbersExchange';
import { RequestRouter } from './omahdog/FlowContext';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';

export const requestRouter = new RequestRouter()
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersLambdaProxy)
    .register(StoreTotalRequest, StoreTotalResponse, StoreTotalMessageProxy)
    ;

export class AddNumbersApiControllerRoutes extends ApiControllerRoutes {

    constructor() {
        super(routes => {
            routes
                .addGet('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy,
                    (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null): AddTwoNumbersRequest => {
                        return {
                            x: parseOptionalInt(queryStringParameters?.x),
                            y: parseOptionalInt(queryStringParameters?.y),
                        };
                    })
                .addGet('/do/add-two-numbers/x/{x}/y/{y}', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy,
                    (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null): AddTwoNumbersRequest => {
                        return {
                            x: parseOptionalInt(pathParameters?.x),
                            y: parseOptionalInt(pathParameters?.y),
                        };
                    })
                .addPost('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersMessageProxy,
                    (pathParameters: StringParameters | null, body: AddTwoNumbersRequest | null): AddTwoNumbersRequest => {
                        return body ?? { x: 0, y: 0 };
                    })
                
                .addGet('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersLambdaProxy,
                    (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null): AddThreeNumbersRequest => {
                        return {
                            a: parseOptionalInt(queryStringParameters?.a),
                            b: parseOptionalInt(queryStringParameters?.b),
                            c: parseOptionalInt(queryStringParameters?.c),
                        };
                    })
                .addPost('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersMessageProxy,
                    (pathParameters: StringParameters | null, body: AddThreeNumbersRequest | null): AddThreeNumbersRequest => {
                        return body ?? { a: 0, b: 0, c: 0 };
                    })
            ;
        });
    }
}

function parseOptionalInt(intString: string | undefined, defaultValue = 0): number  {
    return (intString === undefined) ? defaultValue : parseInt(intString);
}
