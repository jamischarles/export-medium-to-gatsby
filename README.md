#

## A collection of scripts to help scrape job pages and extract the fields from them...

## Note: It's a good idea to separate the scripts that don't need to and won't
run during the web app lifecycle and can be separated. These will run as cron
jobs, and so they should be in a separate location...

## This can  be run from a local laptop or from a server...


## Questions
- Should I convert the markdown version or the html version? Let's start with
	the html version because we can pinpoint the elements in the dom more
	precisely.. 
- How will we verify that the markup hasn't changed? We could run the script and
	verify that it can capture the data needed? Or we could compare an old
	version against a new version and see how different the markup is or the
	important parts... 
-
