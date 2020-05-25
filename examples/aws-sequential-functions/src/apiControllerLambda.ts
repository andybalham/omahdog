import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ApiControllerFunction, ApiControllerRoutes } from './omahdog-aws/ApiControllerFunction';

import { requestRouter } from './requestRouter';
import { handlerFactory } from './handlerFactory';
import { AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy } from './lambdaProxies';
import { AddThreeNumbersMessageProxy, AddTwoNumbersMessageProxy } from './messageProxies';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersResponse, AddTwoNumbersRequest } from './exchanges/AddTwoNumbersExchange';

class AddNumbersApiController extends ApiControllerFunction {

    constructor() { super(requestRouter, handlerFactory); }

    configure(routes: ApiControllerRoutes): void {
        routes
            .addGet('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy,
                (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddTwoNumbersRequest => {
                    return {
                        x: (queryStringParameters?.x == undefined) ? 0 : parseInt(queryStringParameters.x),
                        y: (queryStringParameters?.y == undefined) ? 0 : parseInt(queryStringParameters.y),
                    };
                })
            .addGet('/do/add-two-numbers/x/{x}/y/{y}', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy,
                (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddTwoNumbersRequest => {
                    return {
                        x: (pathParameters?.x == undefined) ? 0 : parseInt(pathParameters.x),
                        y: (pathParameters?.y == undefined) ? 0 : parseInt(pathParameters.y),
                    };
                })
            .addPost('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersMessageProxy,
                (pathParameters: { [name: string]: string } | null, body: AddTwoNumbersRequest | null): AddTwoNumbersRequest => {
                    return body ?? { x: 0, y: 0 };
                })
                
            .addGet('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersLambdaProxy,
                (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddThreeNumbersRequest => {
                    return {
                        a: (queryStringParameters?.a == undefined) ? 0 : parseInt(queryStringParameters.a),
                        b: (queryStringParameters?.b == undefined) ? 0 : parseInt(queryStringParameters.b),
                        c: (queryStringParameters?.c == undefined) ? 0 : parseInt(queryStringParameters.c),
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
    return apiController.handle(event);
};
