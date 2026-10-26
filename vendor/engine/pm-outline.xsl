<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     Publication Module outline extractor.

     Used by the workspace file-tree API and by the release fingerprint, not
     by the publish pipeline. Walks the SAME pmEntry/xi:include structure
     s1000dtojss.xsl uses to build the real book, so the file tree groups Data
     Modules by their actual PMC-defined chapter instead of guessing from the
     DMC filename. Emits tab-separated lines the server parses directly:

       CHAPTER<TAB><chapter title>
       DM<TAB><href><TAB><entry title>
       DMREF<TAB><dmCode string><TAB><entry title>

     THE ENTRY TITLE is the point of this file.

     A data module's own dmTitle is "techName - infoName" — "Flow Schematic -
     Technical description of the equipment" — which is the S1000D catalogue
     name, not what the book calls that section. The publication module
     already carries the book's own name for it:

       <pmEntry>
         <pmEntryTitle>System Overview</pmEntryTitle>      <- the chapter
         <pmEntry>
           <pmEntryTitle>Flow Schematic</pmEntryTitle>     <- THIS
           <pmEntry><xi:include href="csdb/DMC-....xml"/></pmEntry>
         </pmEntry>
       </pmEntry>

     So the title reported here is the nearest ancestor pmEntry that has a
     pmEntryTitle AND is not the chapter itself — otherwise a module sitting
     directly under a chapter would be labelled with the chapter's own name.
     When there is no such title the field is empty and the caller falls back
     to the module's own techName.

     Every reference at any nesting depth under a top-level pmEntry belongs to
     that pmEntry's chapter, in document order — matching how a chapter with
     sub-grouped pmEntry is actually rendered.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xi="http://www.w3.org/2001/XInclude" version="1.0">
    <xsl:output method="text" encoding="UTF-8"/>
    <xsl:strip-space elements="*"/>

    <!--
      The book's name for the entry holding this reference.

      `ancestor::pmEntry` is a reverse axis, so [1] after the predicates picks
      the NEAREST match. `not(parent::content)` excludes the chapter-level
      pmEntry, which is reported separately as CHAPTER.
    -->
    <xsl:template name="entry-title">
        <xsl:value-of select="normalize-space(
            ancestor::pmEntry[pmEntryTitle][not(parent::content)][1]/pmEntryTitle)"/>
    </xsl:template>

    <!-- The dmCode as one dashed string, byte-identical to dmCodeString() in
         engine/resolveDmRefs.js — the two are compared directly. -->
    <xsl:template name="dmcode-string">
        <xsl:for-each select="dmRefIdent/identExtension">
            <xsl:value-of select="@extensionProducer"/><xsl:text>-</xsl:text>
            <xsl:value-of select="@extensionCode"/><xsl:text>-</xsl:text>
        </xsl:for-each>
        <xsl:for-each select="dmRefIdent/dmCode">
            <xsl:value-of select="@modelIdentCode"/><xsl:text>-</xsl:text>
            <xsl:value-of select="@systemDiffCode"/><xsl:text>-</xsl:text>
            <xsl:value-of select="@systemCode"/><xsl:text>-</xsl:text>
            <xsl:value-of select="@subSystemCode"/><xsl:value-of select="@subSubSystemCode"/><xsl:text>-</xsl:text>
            <xsl:value-of select="@assyCode"/><xsl:text>-</xsl:text>
            <xsl:value-of select="@disassyCode"/><xsl:value-of select="@disassyCodeVariant"/><xsl:text>-</xsl:text>
            <xsl:value-of select="@infoCode"/><xsl:value-of select="@infoCodeVariant"/><xsl:text>-</xsl:text>
            <xsl:value-of select="@itemLocationCode"/>
        </xsl:for-each>
    </xsl:template>

    <xsl:template match="/pm/content">
        <xsl:for-each select="pmEntry">
            <xsl:text>CHAPTER&#9;</xsl:text>
            <xsl:value-of select="normalize-space(pmEntryTitle)"/>
            <xsl:text>&#10;</xsl:text>
            <!-- Both reference forms, in document order, so a PM that mixes
                 them is reported completely. -->
            <xsl:for-each select=".//xi:include | .//dmRef">
                <xsl:choose>
                    <xsl:when test="self::dmRef">
                        <xsl:text>DMREF&#9;</xsl:text>
                        <xsl:call-template name="dmcode-string"/>
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:text>DM&#9;</xsl:text>
                        <xsl:value-of select="@href"/>
                    </xsl:otherwise>
                </xsl:choose>
                <xsl:text>&#9;</xsl:text>
                <xsl:call-template name="entry-title"/>
                <xsl:text>&#10;</xsl:text>
            </xsl:for-each>
        </xsl:for-each>
    </xsl:template>

    <!-- No output for anything unmatched (e.g. a JSS-type project's book,
         which has no pm/content at all — the server falls back to the
         filename-based grouping when this produces nothing). -->
    <xsl:template match="text()"/>
</xsl:stylesheet>
