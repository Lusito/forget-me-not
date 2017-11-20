# Forget Me Not Web-Extension

[Install on Firefox](https://addons.mozilla.org/de/firefox/addon/forget_me_not/)

## About the add-on

This web-extension deletes data websites store in the browser in the following situations:

- When all instances of a website have been left:
    - Cookies
    - Local-Storage (Firefox 58+ only)
    - This can be delayed in minutes
    - White- and graylists can be defined
        - White: Always keep cookies for a domain
        - Gray: Keep cookies until browser restart
- When the browser starts:
    - Cookies (optionally only when not whitelisted)
    - Local Storage (optionally only when not whitelisted on Firefox 58+)
	- History
    - Downloads
    - Form Data
    - Passwords
    - Indexed DB
    - Plugin Data
    - Service Workers
    - Server Bound Certificates
- Delete thirdparty cookies on creation
    - When a cookie is set without belonging to a domain that is open in a tab, it is considered a thirdparty cookie.
    - This can be delayed in minutes
    - Rules still apply
- Manually clean the above

## Help
If you have problems, questions or other feedback, please [create an issue](https://github.com/Lusito/forget-me-not/issues) here on Github.

If you like it, please [write a review](https://addons.mozilla.org/de/firefox/addon/forget_me_not/).

## License
The code of this add-on has been released under the [zlib/libpng License](https://github.com/Lusito/forget-me-not/blob/master/LICENSE)
