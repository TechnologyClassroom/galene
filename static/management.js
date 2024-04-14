// Copyright (c) 2024 by Juliusz Chroboczek.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

/**
 * httpError returns an error that encapsulates the status of the response r.
 *
 * @param {Response} r
 * @returns {Error}
 */
function httpError(r) {
    let s = r.statusText;
    if(s === '') {
        switch(r.status) {
            case 401: s = 'Unauthorised'; break;
            case 403: s = 'Forbidden'; break;
            case 404: s = 'Not Found'; break;
        }
    }

    return new Error(`The server said: ${r.status} ${s}`);
}

/**
 * listObjects fetches a list of strings from the given URL.
 *
 * @param {string} url
 * @returns {Promise<Array<string>>}
 */
async function listObjects(url) {
    let r = await fetch(url);
    if(!r.ok)
        throw httpError(r);
    let strings = (await r.text()).split('\n');
    if(strings[strings.length - 1] === '') {
        strings.pop();
    }
    return strings;
}

/**
 * createObject makes a PUT request to url with JSON data.
 * It fails if the object already exists.
 *
 * @param {string} url
 * @param {Object} [values]
 */
async function createObject(url, values) {
    if(!values)
        values = {};
    let r = await fetch(url, {
        method: 'PUT',
        body: JSON.stringify(values),
        headers: {
            'If-None-Match': '*',
            'Content-Type:': 'application/json',
        }
    });
    if(!r.ok)
        throw httpError(r);
}

/**
 * getObject fetches the JSON object at a given URL.
 * If an ETag is provided, it fails if the ETag didn't match.
 *
 * @param {string} url
 * @param {string} [etag]
 * @returns {Promise<Object>}
 */
async function getObject(url, etag) {
    let options = {};
    if(etag) {
        options.headers = {
            'If-Match': etag
        }
    }
    let r = await fetch(url, options);
    if(!r.ok)
        throw httpError(r);
    let newetag = r.headers.get("ETag");
    if(!newetag)
        throw new Error("The server didn't return an ETag");
    if(etag && newetag !== etag)
        throw new Error("The server returned a mismatched ETag");
    let data = await r.json();
    return {etag: newetag, data: data}
}

/**
 * deleteObject makes a DELETE request to the given URL.
 * If an ETag is provided, it fails if the ETag didn't match.
 *
 * @param {string} url
 * @param {string} [etag]
 */
async function deleteObject(url, etag) {
    /** @type {Object<string, string>} */
    let headers = {};
    if(etag)
        headers['If-Match'] = etag;
    let r = await fetch(url, {
        method: 'DELETE',
        headers: headers,
    });
    if(!r.ok)
        throw httpError(r);
}

/**
 * editObject makes a read-modify-write cycle on the given URL.  Any
 * fields that are non-null in values are added or modified, any fields
 * that are null are deleted, any fields that are absent are left unchanged.
 *
 * @param {string} url
 * @param {Object} values
 * @param {string} [etag]
 */
async function editObject(url, values, etag) {
    let old = await getObject(url, etag);
    let data = old.data;
    for(let k in values) {
        if(values[k])
            data[k] = values[k];
        else
            delete(data[k])
    }
    let r = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'If-Match': old.etag,
        }
    })
    if(!r.ok)
        throw httpError(r);
}

/**
 * listGroups returns the list of groups.
 *
 * @returns {Promise<Array<string>>}
 */
async function listGroups() {
    return await listObjects('/galene-api/0/.groups/');
}

/**
 * getGroup returns the sanitised description of the given group.
 *
 * @param {string} group
 * @param {string} [etag]
 * @returns {Promise<Object>}
 */
async function getGroup(group, etag) {
    return await getObject(`/galene-api/0/.groups/${group}`, etag);
}

/**
 * createGroup creates a group.  It fails if the group already exists.
 *
 * @param {string} group
 * @param {Object} [values]
 */
async function createGroup(group, values) {
    return await createObject(`/galene-api/0/.groups/${group}/`, values);
}

/**
 * deleteGroup deletes a group.
 *
 * @param {string} group
 * @param {string} [etag]
 */
async function deleteGroup(group, etag) {
    return await deleteObject(`/galene-api/0/.groups/${group}/`, etag);
}

/**
 * editGroup modifies a group definition.
 * Any fields present in values are overriden, any fields absent in values
 * are left unchanged.
 *
 * @param {string} group
 * @param {Object} values
 * @param {string} [etag]
 */
async function editGroup(group, values, etag) {
    return await editObject(`/galene-api/0/.groups/${group}/`, values);
}

/**
 * listUsers lists the users in a given group.
 *
 * @param {string} group
 * @returns {Promise<Array<string>>}
 */
async function listUsers(group) {
    return await listObjects(`/galene-api/0/.groups/${group}/.users/`);
}

/**
 * getUser returns a given user entry.
 *
 * @param {string} group
 * @param {string} user
 * @param {string} [etag]
 * @returns {Promise<Object>}
 */
async function getUser(group, user, etag) {
    return await getObject(`/galene-api/0/.groups/${group}/.users/${user}`,
                           etag);
}

/**
 * createUser creates a new user entry.  It fails if the user already
 * exists.
 *
 * @param {string} group
 * @param {string} user
 * @param {Object} values
 */
async function createUser(group, user, values) {
    return await createObject(`/galene-api/0/.groups/${group}/.users/${user}/`,
                              values);
}

/**
 * deleteUser deletes a user.
 *
 * @param {string} group
 * @param {string} user
 * @param {string} [etag]
 */
async function deleteUser(group, user, etag) {
    return await deleteObject(
        `/galene-api/0/.groups/${group}/.users/${user}/`, etag,
    );
}

/**
 * editUser modifies a given user entry.
 *
 * @param {string} group
 * @param {string} user
 * @param {Object} values
 * @param {string} [etag]
 */
async function editUser(group, user, values, etag) {
    return await editObject(`/galene-api/0/.groups/${group}/.users/${user}/`,
                            values, etag);
}

/**
 * setPassword sets a user's password.
 * If oldpassword is provided, then it is used for authentication instead
 * of the browser's normal mechanism.
 *
 * @param {string} group
 * @param {string} user
 * @param {string} password
 * @param {string} [oldpassword]
 */
async function setPassword(group, user, password, oldpassword) {
    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: password,
    }
    if(oldpassword) {
        options.credentials = 'omit';
        options.headers['Authorization'] =
            `Basic ${btoa(user + ':' + oldpassword)}`
    }

    let r = await fetch(
        `/galene-api/0/.groups/${group}/.users/${user}/.password`,
        options);
    if(!r.ok)
        throw httpError(r);
}
