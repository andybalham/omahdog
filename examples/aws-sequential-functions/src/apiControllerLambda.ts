import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ApiControllerLambda, ApiControllerRoutes } from './omahdog-aws/ApiControllerLambda';

import { requestRouter } from './requestRouter';
import { handlerFactory } from './lambdaApplication';
import { AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy } from './lambdaProxies';
import { AddThreeNumbersMessageProxy, AddTwoNumbersMessageProxy } from './messageProxies';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersResponse, AddTwoNumbersRequest } from './exchanges/AddTwoNumbersExchange';

export class AddNumbersApiControllerRoutes extends ApiControllerRoutes {}

class Parameters { [name: string]: string }

function parseOptionalInt(intString: string | undefined, defaultValue = 0): number  {
    return (intString === undefined) ? defaultValue : parseInt(intString);
}

export class AddNumbersApiController extends ApiControllerLambda {

    constructor() { super(requestRouter, handlerFactory); }

    configure(routes: ApiControllerRoutes): void {
        routes
            .addGet('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy,
                (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddTwoNumbersRequest => {
                    return {
                        x: parseOptionalInt(queryStringParameters?.x),
                        y: parseOptionalInt(queryStringParameters?.y),
                    };
                })
            .addGet('/do/add-two-numbers/x/{x}/y/{y}', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy,
                (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddTwoNumbersRequest => {
                    return {
                        x: parseOptionalInt(pathParameters?.x),
                        y: parseOptionalInt(pathParameters?.y),
                    };
                })
            .addPost('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersMessageProxy,
                (pathParameters: { [name: string]: string } | null, body: AddTwoNumbersRequest | null): AddTwoNumbersRequest => {
                    return body ?? { x: 0, y: 0 };
                })
                
            .addGet('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersLambdaProxy,
                (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddThreeNumbersRequest => {
                    return {
                        a: parseOptionalInt(queryStringParameters?.a),
                        b: parseOptionalInt(queryStringParameters?.b),
                        c: parseOptionalInt(queryStringParameters?.c),
                    };
                })
            .addPost('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersMessageProxy,
                (pathParameters: { [name: string]: string } | null, body: AddThreeNumbersRequest | null): AddThreeNumbersRequest => {
                    return body ?? { a: 0, b: 0, c: 0 };
                })
        ;
    }
}

const apiController = new AddNumbersApiController;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return await apiController.handle(event);
};
