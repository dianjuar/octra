/**
 * OCTRA API
 * # Introduction The OCTRA-API is a REST-API that allows apps to interact with the OCTRA Database (OCTRA-DB) and its project files.  <img src=\"./assets/octra-backend-diagram.png\" alt=\"octra diagram\" />  In order to use this API you should meet the following requirements:  1. You have a valid app token. You can request an app token from the administrator (contact <a href=\"mailto:octra@phonetik.uni-muenchen.de\">octra@phonetik.uni-muenchen.de</a>).<br/>     The app token should be sent...      a. ... with each HTTP-Request in a HTTP-header called \"X-App-Token\". For example:<br/>     <code>X-App-Token: 7328z4093u4ß92u4902u348</code><br/><br/>     App tokens are bound to specific domains (aka \"origins\").<br/>      b. ... or with each HTTP-Request as cookie \"ocb_app_token\" (added by the server automatically). This method is recommended for web applications.      c. ... or with each HTTP-Request as query parameter \"app_token\" (only recommended for HTML embedded files if cookies can't be used).  2. All HTTP-requests but the authentication methods need the user to be authenticated. The OCTRA-API uses JWT (Jason Web Token) for authentication and authorization.     A successful <a href=\"#tag/Authentication/operation/login\">login request</a> returns the JWT which is valid for 24h. This JWT must be appended ...      a. ... to the \"Authorization\" HTTP-Header. For example: <code>Authorization: Bearer 7328z40293i84ß034293ß02934</code>      b. ... or as cookie called \"ocb_sessiontoken\". You need this e.g. if you want the user to access embedded files in HTML.      c. ... or with each HTTP-Request as query parameter \"session_token\" (only recommended for HTML embedded files if cookies can't be used).  **Notice:** If you call API methods via terminal you can't use cookies and have to add the tokens to the headers or query parameters. If you have to retrieve files from a project programmatically you can add the app and session tokens as query parameters.  ## Role model  This API makes use of a role model. Each user has exactly one global role and project-specific roles.  ### Global roles  <table> <tbody> <tr> <td><code>administrator</code></td> <td>System administrator with full access to all API functions.</td> </tr> <tr> <td><code>user</code></td> <td>Default role for users with normal access rights.</td> </tr> <tr> <td><code>app</code></td> <td>Role for Desktop-applications. See notice below. </td> </tr> </tbody> </table>  #### Notice about app roles  <div style=\"background-color:rgba(255,165,0,0.36);padding:20px;\"> Applications need to be authenticated like normal users but without the need of accepting the data policy and terms & conditions. The owner of the app has to make sure that our policies are accepted by users whose data is shared with octra-backend. </div>  ### Project-specific roles <table> <tbody> <tr> <td><code>project_admin</code></td> <td>Project administrator with administrative access rights for the project he or she is assigned with.</td> </tr> <tr> <td><code>data_delivery</code></td> <td>Data deliverer with limited access rights.</td> </tr> <tr> <td colspan=\"2\">There are custom roles that are created by the administrator. As long as an API method allow role \"user\" a user with a custom role is allows to call this method.</td> </tr> </tbody> </table>
 *
 * OpenAPI spec version: 0.7.8
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
/**
 * the system user role.
 */
export declare class CurrentAccountDtoSystemRole {
    'label': string;
    'i18n': any;
    'badge': any;
    static readonly discriminator: string | undefined;
    static readonly attributeTypeMap: Array<{
        name: string;
        baseName: string;
        type: string;
        format: string;
    }>;
    static getAttributeTypeMap(): {
        name: string;
        baseName: string;
        type: string;
        format: string;
    }[];
    constructor();
}
