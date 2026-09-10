/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import upath from 'upath';
import { runCommand } from './command.js';
import { INDEX_FILE, RELEASE_DIRECTORY, SITE_URL, URL_PREFIX } from './discoveryartifacts.js';

// The archives carry the version in their names, so clients can cache them for a year.
const ARCHIVE_HEADERS = {
	contentType: 'application/gzip',
	cacheControl: 'public, max-age=31536000'
};

// The index changes with every release, so it expires quickly. CloudFront is invalidated after the upload as well.
const INDEX_HEADERS = {
	contentType: 'application/json',
	cacheControl: 'public, max-age=300'
};

/**
 * Uploads the release directory to the S3 bucket behind ckeditor.com, under the path the artifacts are served from,
 * and invalidates that path in CloudFront. The archives go first and the index last, so the index never points at
 * a missing archive. The directory must be verified first (see `verifyDiscoveryArtifacts()`). Needs the AWS CLI on
 * the `PATH` with credentials for the path and the distribution.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @param {string} options.bucket Name of the S3 bucket serving ckeditor.com.
 * @param {string} options.distributionId ID of the CloudFront distribution serving the bucket.
 * @returns {Promise.<Array.<string>>} Public URLs of the uploaded files, in the upload order.
 */
export async function uploadDiscoveryArtifacts( { cwd, bucket, distributionId } ) {
	const releaseDirectory = upath.join( cwd, RELEASE_DIRECTORY );
	const files = await fs.readdir( releaseDirectory );
	const archives = files.filter( file => file !== INDEX_FILE ).sort();
	const uploads = [ ...archives, INDEX_FILE ];

	for ( const file of uploads ) {
		const { contentType, cacheControl } = file === INDEX_FILE ? INDEX_HEADERS : ARCHIVE_HEADERS;

		await runCommand( 'aws', [
			's3', 'cp', upath.join( releaseDirectory, file ), `s3://${ bucket }${ URL_PREFIX }${ file }`,
			'--content-type', contentType,
			'--cache-control', cacheControl
		], { cwd } );
	}

	// CloudFront may still hold the previous index. The archives go too: a rerun of a failed release re-uploads them
	// with different bytes (tar and gzip store timestamps) and new digests in the index. One wildcard path covers all.
	await runCommand( 'aws', [
		'cloudfront', 'create-invalidation',
		'--distribution-id', distributionId,
		'--paths', URL_PREFIX + '*'
	], { cwd } );

	return uploads.map( file => SITE_URL + URL_PREFIX + file );
}
