import { ApiControllerRoutes, StringParameters } from './omahdog-aws/ApiControllerLambda';

import { AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy, AddThreeNumbersMessageProxy, AddTwoNumbersMessageProxy, SumNumbersLambdaProxy, StoreTotalMessageProxy } from './handlerProxies';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersResponse, AddTwoNumbersRequest } from './exchanges/AddTwoNumbersExchange';
import { RequestRouter } from './omahdog/FlowContext';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';

// TODO 30Jun20: This could be changed to be FlowRequestRouter, with .route()
export const requestRouter = new RequestRouter()
    .register(SumNumbersRequest, SumNumbersResponse, SumNumbersLambdaProxy)
    .register(StoreTotalRequest, StoreTotalResponse, StoreTotalMessageProxy)
    ;

export class AddNumbersApiControllerRoutes extends ApiControllerRoutes {

    constructor() {
        super(routes => {
            routes
                .addGet('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersHandler, route => {
                    route.getRequest =
                        (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null): AddTwoNumbersRequest => {
                            return {
                                x: parseOptionalInt(queryStringParameters?.x),
                                y: parseOptionalInt(queryStringParameters?.y),
                            };
                        };                    
                })
                .addGet('/do/add-two-numbers/x/{x}/y/{y}', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy, route => {
                    route.getRequest =
                        (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null): AddTwoNumbersRequest => {
                            return {
                                x: parseOptionalInt(pathParameters?.x),
                                y: parseOptionalInt(pathParameters?.y),
                            };
                        };
                })
                .addPost('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersMessageProxy)
                
                .addGet('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersLambdaProxy, route => {
                    route.getRequest =
                        (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null): AddThreeNumbersRequest => {
                            return {
                                a: parseOptionalInt(queryStringParameters?.a),
                                b: parseOptionalInt(queryStringParameters?.b),
                                c: parseOptionalInt(queryStringParameters?.c),
                            };
                        };
                })
                .addPost('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersMessageProxy)
            ;
        });
    }
}

function parseOptionalInt(intString: string | undefined, defaultValue = 0): number  {
    return (intString === undefined) ? defaultValue : parseInt(intString);
}
