<?php

return [
    /*
     * Where new uploads are written: "public" (this server's disk, the default and what the live
     * site uses) or "s3" (an S3 / Cloudflare R2 bucket; set AWS_* and AWS_URL, ideally a CDN
     * address). Files already uploaded keep working from the disk saved on their own row.
     */
    'disk' => env('MEDIA_DISK', 'public'),
];
