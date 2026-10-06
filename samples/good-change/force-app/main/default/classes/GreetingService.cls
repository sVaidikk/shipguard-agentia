public with sharing class GreetingService {
    public static String greet(String name) {
        return 'Hello, ' + (String.isBlank(name) ? 'friend' : name);
    }

    public static HttpResponse callApi() {
        HttpRequest req = new HttpRequest();
        // GOOD: Named Credential, no secret in code
        req.setEndpoint('callout:Payments_API/charge');
        return new Http().send(req);
    }
}
