public with sharing class PaymentService {
    // BAD: hardcoded credential (fake demo value, not a real secret)
    private static final String apiToken = 'FAKE_demo_token_value_12345';

    public static HttpResponse charge(Decimal amount) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://payments.example.com/charge');
        req.setHeader('Authorization', 'Bearer ' + apiToken);
        req.setBody('{"amount":' + amount + '}');
        return new Http().send(req);
    }
}
