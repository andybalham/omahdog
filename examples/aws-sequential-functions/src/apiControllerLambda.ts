import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FlowContext, AsyncResponse, IActivityRequestHandlerBase, IActivityRequestHandler, RequestRouter, HandlerFactory } from './omahdog/FlowContext';
import { ErrorResponse } from './omahdog/FlowExchanges';
import { requestRouter, handlerFactory } from './requestConfiguration';
import { AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy } from './lambdaProxies';
import { AddThreeNumbersMessageProxy, AddTwoNumbersMessageProxy } from './messageProxies';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersResponse, AddTwoNumbersRequest } from './exchanges/AddTwoNumbersExchange';

// TODO 10May20: Think about how to package this up as a generic class


class ApiControllerRoute {
    httpMethod: string;
    resource: string;
    handlerType: new () => IActivityRequestHandlerBase;
    getRequest: (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null, body: any | null) => any;
    getAPIGatewayProxyResult?: (response: any) => APIGatewayProxyResult
}

class ApiControllerRoutes {

    private readonly routeMap = new Map<string, ApiControllerRoute>();

    addGet<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(
        resource: string, requestType: new () => TReq, responseType: new () => TRes, handlerType: new () => THan, 
        getRequest: (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null) => TReq, 
        getAPIGatewayProxyResult?: (response: TRes) => APIGatewayProxyResult): ApiControllerRoutes {

        const route: ApiControllerRoute = {
            httpMethod: 'GET',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null, body: any | null): any => {
                return getRequest(pathParameters, queryStringParameters);
            },
            getAPIGatewayProxyResult: getAPIGatewayProxyResult        
        };

        // TODO 17May20: Throw an error if duplicate routes
        this.routeMap.set(ApiControllerRoutes.getRouteKey(route.httpMethod, route.resource), route);

        return this;
    }    

    addPost<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(
        resource: string, requestType: new () => TReq, responseType: new () => TRes, handlerType: new () => THan, 
        getRequest: (pathParameters: { [name: string]: string } | null, body: TReq | null) => TReq, 
        getAPIGatewayProxyResult?: (response: TRes) => APIGatewayProxyResult): ApiControllerRoutes {

        const route: ApiControllerRoute = {
            httpMethod: 'POST',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null, body: any | null): any => {
                return getRequest(pathParameters, body);
            },
            getAPIGatewayProxyResult: getAPIGatewayProxyResult        
        };
    
        // TODO 17May20: Throw an error if duplicate routes
        this.routeMap.set(ApiControllerRoutes.getRouteKey(route.httpMethod, route.resource), route);

        return this;
    }

    getRoute(event: APIGatewayProxyEvent): ApiControllerRoute | undefined {
        return this.routeMap.get(ApiControllerRoutes.getRouteKey(event.httpMethod, event.resource));
    }

    private static getRouteKey(httpMethod: string, resource: string): string {
        return `${httpMethod}:${resource}`;
    }
}

abstract class LambdaApiController {

    private readonly apiControllerRoutes: ApiControllerRoutes;
    private readonly requestRouter: RequestRouter;
    private readonly handlerFactory: HandlerFactory;

    constructor(requestRouter: RequestRouter, handlerFactory: HandlerFactory) {

        this.requestRouter = requestRouter;
        this.handlerFactory = handlerFactory;
        this.apiControllerRoutes = new ApiControllerRoutes();

        this.configure(this.apiControllerRoutes);
    }

    abstract configure(routes: ApiControllerRoutes): void;

    async handle(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

        console.log(`event: ${JSON.stringify(event)}`);

        const route = this.apiControllerRoutes.getRoute(event);

        // TODO 17May20: Throw a more meaningful error
        if (route === undefined) throw new Error('route === undefined');

        const request = route.getRequest(event.pathParameters, event.queryStringParameters, event.body);

        console.log(`request: ${JSON.stringify(request)}`);

        const flowContext = FlowContext.newContext(this.requestRouter, this.handlerFactory);

        const response: any | AsyncResponse | ErrorResponse = await flowContext.handleRequest(route.handlerType, request);

        console.log(`response: ${JSON.stringify(response)}`);

        const apiGatewayProxyResult: APIGatewayProxyResult = this.getAPIGatewayProxyResult(response, route);

        console.log(`apiGatewayProxyResult: ${JSON.stringify(apiGatewayProxyResult)}`);

        return apiGatewayProxyResult;
    }

    private getAPIGatewayProxyResult(response: any, route: ApiControllerRoute): APIGatewayProxyResult {

        let apiGatewayProxyResult: APIGatewayProxyResult;

        if ('AsyncResponse' in response) {
            apiGatewayProxyResult = {
                statusCode: 202,
                body: JSON.stringify({ requestId: response.requestId })
            };
        }
        else if ('ErrorResponse' in response) {
            apiGatewayProxyResult = {
                statusCode: 500,
                body: JSON.stringify(response)
            };
        }
        else if (route.getAPIGatewayProxyResult !== undefined) {
            apiGatewayProxyResult = route.getAPIGatewayProxyResult(response);
        }
        else {
            apiGatewayProxyResult = {
                statusCode: 200,
                body: JSON.stringify(response)
            };
        }

        return apiGatewayProxyResult;
    }
}

class AddNumbersApiController extends LambdaApiController {

    // TODO 17May20: Do we know we definitely need the following?
    constructor() { super(requestRouter, handlerFactory); }

    configure(routes: ApiControllerRoutes): void {
        routes
            .addGet('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy,
                (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddTwoNumbersRequest => {
                    return {
                        x: (queryStringParameters?.x == undefined) ? 0 : parseInt(queryStringParameters.x),
                        y: (queryStringParameters?.y == undefined) ? 0 : parseInt(queryStringParameters.y),
                    };
                },
                (response: AddTwoNumbersResponse): APIGatewayProxyResult => {
                    return {
                        statusCode: 200,
                        body: JSON.stringify(response)
                    };
                })
            .addPost('/do/add-two-numbers', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersMessageProxy,
                (pathParameters: { [name: string]: string } | null, body: AddTwoNumbersRequest | null): AddTwoNumbersRequest => {
                    return body ?? { x: 0, y: 0 };
                })
            .addGet('/do/add-two-numbers/x/{x}/y/{y}', AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersLambdaProxy,
                (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddTwoNumbersRequest => {
                    return {
                        x: (pathParameters?.x == undefined) ? 0 : parseInt(pathParameters.x),
                        y: (pathParameters?.y == undefined) ? 0 : parseInt(pathParameters.y),
                    };
                })
            // .addGet('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersLambdaProxy,
            //     (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null): AddThreeNumbersRequest => {
            //         return {
            //             a: (queryStringParameters?.a == undefined) ? 0 : parseInt(queryStringParameters.a),
            //             b: (queryStringParameters?.b == undefined) ? 0 : parseInt(queryStringParameters.b),
            //             c: (queryStringParameters?.c == undefined) ? 0 : parseInt(queryStringParameters.c),
            //         };
            //     })
            // .addPost('/do/add-three-numbers', AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersMessageProxy,
            //     (pathParameters: { [name: string]: string } | null, body: AddThreeNumbersRequest | null): AddThreeNumbersRequest => {
            //         return body ?? { a: 0, b: 0, c: 0 };
            //     })
        ;
    }
}

const apiController = new AddNumbersApiController;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    return apiController.handle(event);

    /*
    try {
        
        console.log(`event: ${JSON.stringify(event)}`);

        const functionName = event.pathParameters?.functionName;

        if (functionName === undefined) throw new Error('functionName === undefined');
        
        let request: any;
        if (event.httpMethod === 'GET') {

            if (event.queryStringParameters === null) throw new Error('event.queryStringParameters === null');

            request = {};
            for (const key in event.queryStringParameters) {
                const value = event.queryStringParameters[key];
                request[key] = parseFloat(value);
            }

        } else {

            if (event.body === null) throw new Error('Request body was null');
        
            request = JSON.parse(event.body);
        }

        console.log(`request: ${JSON.stringify(request)}`);

        const flowContext = FlowContext.newContext(requestRouter, handlerFactory);

        let response: any;

        switch (functionName) {
        case 'add-two-numbers':
            response = await handleAddTwoNumbersRequest(flowContext, event.httpMethod, request);
            break;
        case 'add-three-numbers':
            response = await handleAddThreeNumbersRequest(flowContext, event.httpMethod, request);
            break;
        default:
            throw new Error(`Unhandled function: ${functionName}`);
        }

        return response;

    } catch (error) {
        console.error(`error.message: ${error.message}`);        
        console.error(`error.stack: ${error.stack}`);        

        return {
            statusCode: 500,
            body: `error.stack: ${error.stack}`
        };
    }
    */
};

async function handleAddThreeNumbersRequest(flowContext: FlowContext, httpMethod: string, request: AddThreeNumbersRequest): 
    Promise<APIGatewayProxyResult> {

    let handlerType: new () => IActivityRequestHandlerBase;

    switch (httpMethod) {
    case 'GET':
        handlerType = AddThreeNumbersLambdaProxy;
        break;        
    case 'POST':
        handlerType = AddThreeNumbersMessageProxy;
        break;            
    default:
        throw new Error(`Unhandled invocationMethod: ${httpMethod}`);
    }
    
    const response: AddThreeNumbersResponse | AsyncResponse | ErrorResponse = 
        await flowContext.handleRequest(handlerType, request);   

    if ('AsyncResponse' in response) {
        return {
            statusCode: 202,
            body: JSON.stringify({ requestId: response.requestId })
        };    
    }
    
    if ('ErrorResponse' in response) {
        return {
            statusCode: 500,
            body: JSON.stringify(response)
        };    
    }

    return {
        // TODO 10May20: The status code here could well depend on the response
        statusCode: 200,
        body: JSON.stringify(response)
    };    
}

async function handleAddTwoNumbersRequest(flowContext: FlowContext, httpMethod: string, request: AddTwoNumbersRequest): 
    Promise<APIGatewayProxyResult> {

    let handlerType: new () => IActivityRequestHandlerBase;

    switch (httpMethod) {
    case 'GET':
        handlerType = AddTwoNumbersLambdaProxy;
        break;        
    case 'POST':
        handlerType = AddTwoNumbersMessageProxy;
        break;            
    default:
        throw new Error(`Unhandled invocationMethod: ${httpMethod}`);
    }
    
    const response: AddTwoNumbersResponse | AsyncResponse | ErrorResponse = 
        await flowContext.handleRequest(handlerType, request);   

    if ('AsyncResponse' in response) {
        return {
            statusCode: 202,
            body: JSON.stringify({ requestId: response.requestId })
        };    
    }
    
    if ('ErrorResponse' in response) {
        return {
            statusCode: 500,
            body: JSON.stringify(response)
        };    
    }

    return {
        // TODO 10May20: The status code here could well depend on the response
        statusCode: 200,
        body: JSON.stringify(response)
    };    
}
