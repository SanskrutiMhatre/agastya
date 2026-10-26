<?xml version="1.0" encoding="UTF-8"?>
<!-- Parse-only stylesheet: xsltproc must be given one, and this deliberately
     produces nothing. Run with the no-output flag, the whole point is that
     libxml2 reads the document and reports what is wrong with it. The same
     parser the build uses, so validation and the build can never disagree.
     (No double hyphen in this comment: XML forbids it, as this file found out.) -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:output method="text"/>
  <xsl:template match="/"/>
</xsl:stylesheet>
