import {isNullOrUndefined} from 'util';
import {Http, RequestOptions, RequestOptionsArgs, Response, URLSearchParams} from '@angular/http';
import {Observable} from 'rxjs/Observable';

export interface FileSize {
  size: number;
  label: string;
}
;

export class Functions {
  public static scrollTo(y: number, target?: string) {
    setTimeout(() => {
      if (isNullOrUndefined(target)) {
        jQuery('html, body').scrollTop(y);
      } else {
        jQuery(target).scrollTop(y);
      }
    }, 200);
  }

  public static buildStr(str: string, replace_arr: any[]) {
    let result: string = str;

    const reg: RegExp = /({[0-9]+})+/g;
    const count = result.match(reg).length;

    if (count === replace_arr.length) {
      for (let i = 0; i < replace_arr.length; i++) {
        const replace_str = (replace_arr[i] !== null) ? replace_arr[i].toString() : 'null';

        result = result.replace('{' + i + '}', replace_str);
      }
    } else {
      throw new Error('buildStr: number of placeholders do not match with array');
    }

    return result;
  }

  public static isNumber(str: string): boolean {
    const res = parseInt(str, 10);
    return isNaN(res) ? false : true;
  }

  public static equalProperties(elem: any, elem2: any) {
    let result = false;

    for (const el in elem) {
      if (elem.hasOwnProperty(el)) {
        const prop_str = '' + el + '';
        result = true;
        if (!(prop_str in elem2)) {
          return false;
        }
      }
    }

    return result;
  }

  public static contains(haystack: string, needle: string): boolean {
    return haystack.indexOf(needle) !== -1;
  }

  public static placeAtEnd(element: HTMLElement) {
    try {
      element.focus();
      const bodyInput: any = document.body as any;
      if (jQuery(element).text() !== '') {
        if (typeof window.getSelection !== 'undefined'
          && typeof document.createRange !== 'undefined'
        ) {
          // get range
          const txtRange = document.createRange();
          txtRange.selectNodeContents(element);
          // set range to end
          txtRange.collapse(false);

          // get selection of the element
          const selection = window.getSelection();
          selection.removeAllRanges();
          // set previous created range to the element
          selection.addRange(txtRange);
        } else if (bodyInput.createTextRange !== 'undefined') {
          // fix for IE and older Opera Browsers

          // create range from body
          const txtRange = bodyInput.createTextRange();
          txtRange.moveToElementText(element);
          // set selection to end
          txtRange.collapse(false);
          txtRange.select();
        }
      }
    } catch (ex) {
      console.error('error in Functions.placeAt');
      // ignore
    }
  }

  public static escapeRegex(regex_str: string) {
    // escape special chars in regex
    return regex_str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  public static getFileSize(bytes: number): FileSize {
    const result: FileSize = {
      size: 0,
      label: ''
    };

    if ((bytes / 1000) < 1) {
      // take bytes
      result.size = bytes;
      result.label = 'B';
    } else if (bytes / (1000 * 1000) < 1) {
      // take kilobytes
      result.size = bytes / 1000;
      result.label = 'KB';
    } else if (bytes / (1000 * 1000 * 1000) < 1) {
      // take megabyte
      result.size = bytes / 1000 / 1000;
      result.label = 'MB';
    } else if (bytes / (1000 * 1000 * 1000 * 1000) < 1) {
      // take gigabytes

      result.size = bytes / 1000 / 1000 / 1000;
      result.label = 'GB';
    }

    result.size = Math.round(result.size * 1000) / 1000;

    return result;
  }

  public static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public static unEscapeHtml(text: string): string {
    return text
      .replace('&amp;', '&')
      .replace('&lt;', '<')
      .replace('&gt;', '>')
      .replace('&quot;', '"')
      .replace('&#039;', '\'');
  }

  public static insertString(input: string, pos: number, insertion: string): string {
    let result = input;

    if (pos <= input.length) {
      result = result.substring(0, pos) + insertion + result.substring(pos);
    } else {
      throw new Error('String cannot be inserted at position ' + pos);
    }

    return result;
  }

  public static uniqueHTTPRequest(http: Http, post: boolean = false, requestoptions: RequestOptionsArgs, url: string, body: any): Observable<Response> {
    if (!post) {
      const params: URLSearchParams = new URLSearchParams();
      const d = Date.now();
      params.set('v', d.toString());

      const requestOptions = new RequestOptions();
      requestOptions.params = params;

      return http.get(url, requestOptions);
    } else {
      return http.post(url, body, requestoptions);
    }
  }

  public static setCursor(node, pos) {

    node = (typeof node === 'string' || node instanceof String) ? document.getElementById('' + node + '') : node;

    if (!node) {
      return false;
    } else if (node.createTextRange) {
      const textRange = node.createTextRange();
      textRange.collapse(true);
      textRange.moveEnd(pos);
      textRange.moveStart(pos);
      textRange.select();
      return true;
    } else if (node.setSelectionRange) {
      node.setSelectionRange(pos, pos);
      return true;
    }

    return false;
  }
}