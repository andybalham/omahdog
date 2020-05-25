import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FlowContext, AsyncResponse, IActivityRequestHandlerBase, IActivityRequestHandler, RequestRouter, HandlerFactory } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';

export abstract class ApiControllerFunction {

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

class ApiControllerRoute {
    httpMethod: string;
    resource: string;
    handlerType: new () => IActivityRequestHandlerBase;
    getRequest: (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null, body: string | null) => any;
    getAPIGatewayProxyResult?: (response: any) => APIGatewayProxyResult
}

export class ApiControllerRoutes {

    private readonly routeMap = new Map<string, ApiControllerRoute>();

    addGet<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(
        resource: string, requestType: new () => TReq, responseType: new () => TRes, handlerType: new () => THan, 
        getRequest: (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null) => TReq, 
        getAPIGatewayProxyResult?: (response: TRes) => APIGatewayProxyResult): ApiControllerRoutes {

        const route: ApiControllerRoute = {
            httpMethod: 'GET',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null, body: string | null): any => {
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
            getRequest: (pathParameters: { [name: string]: string } | null, queryStringParameters: { [name: string]: string } | null, body: string | null): any => {
                return getRequest(pathParameters, (body === null) ? null : JSON.parse(body));
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
