<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     JSS to XSL-FO: List of Contents / Figures / Tables / Annexures

     Entries are generated from the body content, with a dot leader and the
     resolved page number via fo:page-number-citation.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <!--
      One TOC line: text, dot leader, page reference.

      $chapter is the chapter the target lives in. Body folios are
      chapter-relative, so the citation alone would read "1" where the printed
      page reads "1-1"; the chapter number is prefixed to match.
    -->
    <xsl:template name="toc-line">
        <xsl:param name="label"/>
        <xsl:param name="text"/>
        <xsl:param name="ref"/>
        <xsl:param name="indent">0mm</xsl:param>
        <xsl:param name="bold">0</xsl:param>
        <xsl:param name="chapter"/>
        <fo:block space-after="1.5mm"
                  start-indent="{$indent}"
                  text-align-last="justify">
            <xsl:if test="$bold = '1'">
                <xsl:attribute name="font-weight">bold</xsl:attribute>
            </xsl:if>
            <fo:basic-link internal-destination="{$ref}">
                <xsl:if test="$label != ''">
                    <xsl:value-of select="$label"/>
                    <xsl:text>&#160;&#160;</xsl:text>
                </xsl:if>
                <xsl:value-of select="$text"/>
            </fo:basic-link>
            <fo:inline keep-together.within-line="always">
                <fo:leader leader-pattern="dots" leader-length.minimum="12pt"
                           leader-length.optimum="100pt" leader-length.maximum="100%"/>
                <fo:basic-link internal-destination="{$ref}">
                    <xsl:if test="$chapter != ''">
                        <xsl:value-of select="$chapter"/>
                        <xsl:text>-</xsl:text>
                    </xsl:if>
                    <fo:page-number-citation ref-id="{$ref}"/>
                </fo:basic-link>
            </fo:inline>
        </fo:block>
    </xsl:template>

    <!-- ==================== LIST OF CONTENTS ==================== -->
    <xsl:template match="listOfContents">
        <fo:block break-before="page">
            <xsl:call-template name="page-title">
                <xsl:with-param name="text">
                    <xsl:call-template name="fm-heading">
                        <xsl:with-param name="override" select="$fm.title.listOfContents"/>
                        <xsl:with-param name="default">LIST OF CONTENTS</xsl:with-param>
                    </xsl:call-template>
                </xsl:with-param>
            </xsl:call-template>
            <xsl:for-each select="/jssbook/body/chapter">
                <xsl:call-template name="toc-line">
                    <xsl:with-param name="label">
                        <xsl:text>CHAPTER </xsl:text><xsl:value-of select="@number"/>
                    </xsl:with-param>
                    <xsl:with-param name="text" select="translate(title, $lower, $upper)"/>
                    <xsl:with-param name="ref" select="concat('chapter-', @number)"/>
                    <xsl:with-param name="bold">1</xsl:with-param>
                    <xsl:with-param name="chapter" select="@number"/>
                </xsl:call-template>
                <!-- Only sections down to $toc.section.depth are listed. The
                     stencil's contents page shows chapters and their top-level
                     sections; listing every nested level turns the contents of
                     a large publication into dozens of pages. -->
                <xsl:for-each select=".//section[not(@split)][count(ancestor::section[not(@split)]) &lt; $toc.section.depth]">
                    <xsl:call-template name="toc-line">
                        <xsl:with-param name="label"><xsl:call-template name="section-number"/></xsl:with-param>
                        <xsl:with-param name="text" select="title"/>
                        <xsl:with-param name="ref" select="generate-id(.)"/>
                        <xsl:with-param name="indent" select="concat(6 * count(ancestor::section) + 6, 'mm')"/>
                        <xsl:with-param name="chapter" select="ancestor::chapter[1]/@number"/>
                    </xsl:call-template>
                </xsl:for-each>
            </xsl:for-each>
        </fo:block>
    </xsl:template>

    <!-- ==================== LIST OF FIGURES ==================== -->
    <xsl:template match="listOfFigures">
        <fo:block break-before="page">
            <xsl:call-template name="page-title">
                <xsl:with-param name="text">
                    <xsl:call-template name="fm-heading">
                        <xsl:with-param name="override" select="$fm.title.listOfFigures"/>
                        <xsl:with-param name="default">LIST OF FIGURES</xsl:with-param>
                    </xsl:call-template>
                </xsl:with-param>
            </xsl:call-template>
            <xsl:for-each select="/jssbook/body//figure[title]">
                <xsl:call-template name="toc-line">
                    <xsl:with-param name="text">
                        <xsl:text>Figure </xsl:text>
                        <xsl:call-template name="figure-number"/>
                        <xsl:text>: </xsl:text>
                        <xsl:value-of select="title"/>
                    </xsl:with-param>
                    <xsl:with-param name="ref">
                        <xsl:call-template name="element-id"/>
                    </xsl:with-param>
                    <xsl:with-param name="chapter" select="ancestor::chapter[1]/@number"/>
                </xsl:call-template>
            </xsl:for-each>
        </fo:block>
    </xsl:template>

    <!-- ==================== LIST OF TABLES ==================== -->
    <xsl:template match="listOfTables">
        <fo:block break-before="page">
            <xsl:call-template name="page-title">
                <xsl:with-param name="text">
                    <xsl:call-template name="fm-heading">
                        <xsl:with-param name="override" select="$fm.title.listOfTables"/>
                        <xsl:with-param name="default">LIST OF TABLES</xsl:with-param>
                    </xsl:call-template>
                </xsl:with-param>
            </xsl:call-template>
            <xsl:for-each select="/jssbook/body//table[title]">
                <xsl:call-template name="toc-line">
                    <xsl:with-param name="text">
                        <xsl:text>Table </xsl:text>
                        <xsl:call-template name="table-number"/>
                        <xsl:text>: </xsl:text>
                        <xsl:value-of select="title"/>
                    </xsl:with-param>
                    <xsl:with-param name="ref">
                        <xsl:call-template name="element-id"/>
                    </xsl:with-param>
                    <xsl:with-param name="chapter" select="ancestor::chapter[1]/@number"/>
                </xsl:call-template>
            </xsl:for-each>
        </fo:block>
    </xsl:template>

    <!-- ==================== LIST OF ANNEXURES ==================== -->
    <!-- Annexures are authored explicitly since they are not derived from the
         chapter tree. -->
    <xsl:template match="listOfAnnexures">
        <fo:block break-before="page">
            <xsl:call-template name="page-title">
                <xsl:with-param name="text">LIST OF ANNEXURES</xsl:with-param>
            </xsl:call-template>
            <xsl:for-each select="annexure">
                <fo:block space-after="1.5mm" text-align-last="justify">
                    <xsl:text>Annexure </xsl:text>
                    <xsl:value-of select="@id"/>
                    <xsl:text>: </xsl:text>
                    <xsl:value-of select="."/>
                    <fo:inline keep-together.within-line="always">
                        <fo:leader leader-pattern="dots" leader-length.minimum="12pt"
                                   leader-length.optimum="100pt" leader-length.maximum="100%"/>
                        <xsl:value-of select="@page"/>
                    </fo:inline>
                </fo:block>
            </xsl:for-each>
        </fo:block>
    </xsl:template>

    <!-- ==================== PDF BOOKMARKS ==================== -->
    <xsl:template name="bookmark-tree">
        <xsl:if test="/jssbook/body/chapter">
            <fo:bookmark-tree>
                <xsl:for-each select="/jssbook/body/chapter">
                    <fo:bookmark internal-destination="{concat('chapter-', @number)}">
                        <fo:bookmark-title>
                            <xsl:text>Chapter </xsl:text>
                            <xsl:value-of select="@number"/>
                            <xsl:text> - </xsl:text>
                            <xsl:value-of select="title"/>
                        </fo:bookmark-title>
                        <xsl:for-each select="section">
                            <fo:bookmark internal-destination="{generate-id(.)}">
                                <fo:bookmark-title><xsl:value-of select="title"/></fo:bookmark-title>
                            </fo:bookmark>
                        </xsl:for-each>
                    </fo:bookmark>
                </xsl:for-each>
            </fo:bookmark-tree>
        </xsl:if>
    </xsl:template>

</xsl:stylesheet>
