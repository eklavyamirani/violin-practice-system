// Publish step (stub). The finished mp4 is meant to go to the platform's Downloads app under
// demos/<app>/<proposal-id>/ (eklavyamirani/app-platform#82, which depends on the Downloads publishing epic,
// eklavyamirani/app-platform#67). Until that upload path exists, the video stays in the session and the
// session sends the file to the owner itself.
//
// The seam: replace `upload` with the platform's upload helper. It gets the local file and the remote
// path, and returns the link the session should give the owner. Nothing else in the runner changes.
import path from "node:path";

export const remotePath = (p, file) => `demos/${p.app}/${p.id}/${path.basename(file)}`;

async function upload(/* file, remote */) {
  return null; // not wired yet: no upload, no link
}

/**
 * Returns { uploaded, remote, link, local, message }. `message` is what the session tells the owner.
 */
export async function publish({ proposal, file }) {
  const remote = remotePath(proposal, file);
  const link = await upload(file, remote);
  if (!link) {
    return { uploaded: false, remote, link: null, local: file,
      message: `Not uploaded (the Downloads upload isn't wired yet). The video is at ${file}; send it to the owner from the session. Its upload path will be ${remote}.` };
  }
  return { uploaded: true, remote, link, local: file, message: `Uploaded to ${remote}: ${link}` };
}
