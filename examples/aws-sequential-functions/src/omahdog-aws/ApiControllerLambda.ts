import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FlowContext, AsyncResponse, IActivityRequestHandlerBase, IActivityRequestHandler, RequestRouter, HandlerFactory } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { LambdaBase, TemplateReference } from './SAMTemplate';

export class ApiControllerLambda extends LambdaBase {

    readonly apiGatewayReference: TemplateReference;
    readonly apiControllerRoutesType: new () => ApiControllerRoutes;

    constructor(apiGatewayReference: TemplateReference, apiControllerRoutesType: new () => ApiControllerRoutes, initialise?: (lambda: ApiControllerLambda) => void) {

        super(`${apiControllerRoutesType.name}Function`);

        this.apiGatewayReference = apiGatewayReference;
        this.apiControllerRoutesType = apiControllerRoutesType;

        console.log(`${ApiControllerLambda.name}.resourceName: ${this.resourceName}`);

        if (initialise !== undefined) {
            initialise(this);            
        }
    }

    async handle(event: APIGatewayProxyEvent, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<APIGatewayProxyResult> {

        console.log(`event: ${JSON.stringify(event)}`);

        // TODO 10Jun20: What validation do we want to do?
        // this.throwErrorIfInvalid();

        // TODO 03Jun20: Would we want to instantiate this each time?
        const apiControllerRoutes = new this.apiControllerRoutesType;
        const route = apiControllerRoutes.getRoute(event);

        // TODO 17May20: Throw a more meaningful error
        if (route === undefined) throw new Error('route === undefined');

        const request = route.getRequest(event.pathParameters, event.queryStringParameters, event.body);

        console.log(`request: ${JSON.stringify(request)}`);

        const flowContext = FlowContext.newContext(requestRouter, handlerFactory);

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

export class StringParameters { [name: string]: string }

class ApiControllerRoute {
    httpMethod: string;
    resource: string;
    handlerType: new () => IActivityRequestHandlerBase;
    getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null) => any;
    getAPIGatewayProxyResult?: (response: any) => APIGatewayProxyResult
}

export abstract class ApiControllerRoutes {

    private readonly routeMap = new Map<string, ApiControllerRoute>();

    constructor(initialise: (routes: ApiControllerRoutes) => void) {
        initialise(this);
    }

    addGet<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(
        resource: string, requestType: new () => TReq, responseType: new () => TRes, handlerType: new () => THan, 
        getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null) => TReq, 
        getAPIGatewayProxyResult?: (response: TRes) => APIGatewayProxyResult): ApiControllerRoutes {

        const route: ApiControllerRoute = {
            httpMethod: 'GET',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null): any => {
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
        getRequest: (pathParameters: StringParameters | null, body: TReq | null) => TReq, 
        getAPIGatewayProxyResult?: (response: TRes) => APIGatewayProxyResult): ApiControllerRoutes {

        const route: ApiControllerRoute = {
            httpMethod: 'POST',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null): any => {
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
